const fs = require('fs-extra');
const path = require('path');
const mqtt = require('mqtt');

module.exports = function(app) {
  let plugin = {};
  let unsubscribes = [];
  let mqttClient = null;
  let activeSubscriptions = new Map(); // Track active subscriptions
  let exportRules = []; // Store export rules
  let lastSentValues = new Map(); // Track last sent values for change detection

  plugin.id = 'zennora-signalk-mqtt-export';
  plugin.name = 'Zennora MQTT Export Manager';
  plugin.description = 'Selectively export SignalK data to MQTT with webapp management interface';

  plugin.start = function(options) {
    app.debug('Starting Zennora MQTT Export Manager plugin');
    
    const config = {
      mqttBroker: options?.mqttBroker || 'mqtt://localhost:1883',
      mqttClientId: options?.mqttClientId || 'signalk-mqtt-export',
      mqttUsername: options?.mqttUsername || '',
      mqttPassword: options?.mqttPassword || '',
      topicPrefix: options?.topicPrefix || '',
      enabled: options?.enabled || true,
      exportRules: options?.exportRules || getDefaultExportRules()
    };

    plugin.config = config;
    exportRules = config.exportRules;

    if (!config.enabled) {
      app.debug('MQTT Export plugin disabled');
      return;
    }

    // Initialize MQTT client
    initializeMQTTClient(config);

    // Set up SignalK subscriptions based on export rules
    updateSubscriptions();

    app.debug('Zennora MQTT Export Manager plugin started');
  };

  plugin.stop = function() {
    app.debug('Stopping Zennora MQTT Export Manager plugin');
    
    // Disconnect MQTT client
    if (mqttClient) {
      mqttClient.end();
      mqttClient = null;
    }

    // Unsubscribe from all SignalK subscriptions
    unsubscribes.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    unsubscribes = [];
    
    activeSubscriptions.clear();
    lastSentValues.clear();
    app.debug('Zennora MQTT Export Manager plugin stopped');
  };

  // Initialize MQTT client
  function initializeMQTTClient(config) {
    try {
      const mqttOptions = {
        clientId: config.mqttClientId,
        clean: true,
        reconnectPeriod: 5000,
        keepalive: 60
      };

      if (config.mqttUsername && config.mqttPassword) {
        mqttOptions.username = config.mqttUsername;
        mqttOptions.password = config.mqttPassword;
      }

      mqttClient = mqtt.connect(config.mqttBroker, mqttOptions);

      mqttClient.on('connect', () => {
        app.debug(`✅ Connected to MQTT broker: ${config.mqttBroker}`);
      });

      mqttClient.on('error', (error) => {
        app.debug(`❌ MQTT client error: ${error.message}`);
      });

      mqttClient.on('close', () => {
        app.debug('🔌 MQTT client disconnected');
      });

      mqttClient.on('reconnect', () => {
        app.debug('🔄 MQTT client reconnecting...');
      });

    } catch (error) {
      app.debug(`Failed to initialize MQTT client: ${error.message}`);
    }
  }

  // Update SignalK subscriptions based on export rules
  function updateSubscriptions() {
    // Clear existing subscriptions
    unsubscribes.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    unsubscribes = [];
    activeSubscriptions.clear();

    // Group export rules by context for efficient subscriptions
    const contextGroups = new Map();
    exportRules.filter(rule => rule.enabled).forEach(rule => {
      const context = rule.context || 'vessels.self';
      if (!contextGroups.has(context)) {
        contextGroups.set(context, []);
      }
      contextGroups.get(context).push(rule);
    });

    // Create subscriptions for each context group
    contextGroups.forEach((rules, context) => {
      const subscription = {
        context: context,
        subscribe: rules.map(rule => ({
          path: rule.path,
          period: rule.period || 1000
        }))
      };

      app.debug(`Creating subscription for context ${context} with ${rules.length} paths`);

      app.subscriptionmanager.subscribe(
        subscription,
        unsubscribes,
        (subscriptionError) => {
          app.debug(`Subscription error for ${context}:`, subscriptionError);
        },
        (delta) => {
          handleSignalKData(delta, rules);
        }
      );

      activeSubscriptions.set(context, rules);
    });

    app.debug(`Active subscriptions: ${activeSubscriptions.size} contexts, ${exportRules.filter(r => r.enabled).length} total rules`);
  }

  // Handle incoming SignalK data
  function handleSignalKData(delta, contextRules) {
    if (!delta.updates || !mqttClient || !mqttClient.connected) {
      return;
    }

    delta.updates.forEach(update => {
      if (!update.values) return;

      update.values.forEach(valueUpdate => {
        // Find matching export rule
        const rule = contextRules.find(r => {
          if (!r.enabled) return false;
          
          // Check path match (support wildcards)
          let pathMatch = false;
          if (r.path === '*') {
            pathMatch = true;
          } else if (r.path === valueUpdate.path) {
            pathMatch = true;
          } else if (r.path.endsWith('*')) {
            // Handle wildcard patterns like "navigation*"
            const prefix = r.path.slice(0, -1);
            pathMatch = valueUpdate.path.startsWith(prefix);
          }
          
          if (!pathMatch) {
            return false;
          }
          
          // Check source match
          const sourceMatch = !r.source || !r.source.trim() || r.source === (update.$source || update.source?.label);
          if (!sourceMatch) return false;
          
          // Check MMSI exclusion list
          if (r.excludeMMSI && r.excludeMMSI.trim() && delta.context) {
            const excludedMMSIs = r.excludeMMSI.split(',').map(mmsi => mmsi.trim());
            const contextHasExcludedMMSI = excludedMMSIs.some(mmsi => 
              delta.context.includes(mmsi)
            );
            if (contextHasExcludedMMSI) {
              return false;
            }
          }
          
          return true;
        });

        if (rule) {
          publishToMQTT(delta, update, valueUpdate, rule);
        }
      });
    });
  }

  // Publish data to MQTT
  function publishToMQTT(delta, update, valueUpdate, rule) {
    try {
      const context = delta.context || 'vessels.self';
      const path = valueUpdate.path;
      const value = valueUpdate.value;

      // Check if we should only send on change
      if (rule.sendOnChange) {
        const valueKey = `${context}:${path}`;
        const lastValue = lastSentValues.get(valueKey);
        
        // Compare values (handle objects and primitives)
        const currentValueString = typeof value === 'object' ? JSON.stringify(value) : String(value);
        
        // If we have a previous value, compare it
        if (lastValue !== undefined) {
          const lastValueString = typeof lastValue === 'object' ? JSON.stringify(lastValue) : String(lastValue);
          
          if (currentValueString === lastValueString) {
            // Value hasn't changed, don't send
            return;
          }
        }
        
        // Store new value for next comparison (either first time or value changed)
        lastSentValues.set(valueKey, value);
      }

      // Build MQTT topic
      let topic = '';
      if (plugin.config.topicPrefix) {
        topic = `${plugin.config.topicPrefix}/`;
      }
      
      if (rule.topicTemplate) {
        // Use custom topic template
        topic += rule.topicTemplate
          .replace('{context}', context)
          .replace('{path}', path)
          .replace(/\./g, '/');
      } else {
        // Default topic structure: context/path
        topic += `${context}/${path}`.replace(/\./g, '/');
      }

      // Build payload
      let payload;
      if (rule.payloadFormat === 'value-only') {
        payload = typeof value === 'object' ? JSON.stringify(value) : String(value);
      } else {
        // Default: use original SignalK delta structure (preserves all source info)
        payload = JSON.stringify(delta);
      }

      // Publish to MQTT
      mqttClient.publish(topic, payload, { qos: rule.qos || 0, retain: rule.retain || false }, (err) => {
        if (err) {
          app.debug(`MQTT publish error: ${err.message}`);
        } else {
          app.debug(`✅ Published to MQTT: ${topic} = ${payload.substring(0, 100)}${payload.length > 100 ? '...' : ''}`);
        }
      });

    } catch (error) {
      app.debug(`Error publishing to MQTT: ${error.message}`);
    }
  }

  // Get default export rules (based on actual SignalK data sources)
  function getDefaultExportRules() {
    return [
      {
        id: 'all-navigation',
        name: 'All Navigation Data',
        context: 'vessels.self',
        path: '*',
        source: '', // All sources
        enabled: true,
        period: 1000,
        qos: 0,
        retain: false,
        payloadFormat: 'full',
        sendOnChange: true
      },
      {
        id: 'derived-data',
        name: 'Derived Data',
        context: 'vessels.self',
        path: '*',
        source: 'derived-data',
        enabled: true,
        period: 1000,
        qos: 0,
        retain: false,
        payloadFormat: 'full',
        sendOnChange: true
      },
      {
        id: 'pypilot',
        name: 'PyPilot Data',
        context: 'vessels.self',
        path: '*',
        source: 'pypilot',
        enabled: true,
        period: 1000,
        qos: 0,
        retain: false,
        payloadFormat: 'full',
        sendOnChange: true
      },
      {
        id: 'anchoralarm',
        name: 'Anchor Alarm',
        context: 'vessels.self',
        path: '*',
        source: 'anchoralarm',
        enabled: true,
        period: 1000,
        qos: 0,
        retain: false,
        payloadFormat: 'full',
        sendOnChange: true
      },
      {
        id: 'all-vessels',
        name: 'All Vessels (AIS)',
        context: 'vessels.*',
        path: '*',
        source: '', // All sources
        excludeMMSI: '368396230', // Exclude own vessel
        enabled: true,
        period: 1000,
        qos: 0,
        retain: false,
        payloadFormat: 'full',
        sendOnChange: true
      },
      {
        id: 'ais-vessels',
        name: 'AIS Vessels',
        context: 'vessels.urn:*',
        path: '*',
        source: '', // All sources
        excludeMMSI: '368396230', // Exclude own vessel
        enabled: true,
        period: 1000,
        qos: 0,
        retain: false,
        payloadFormat: 'full',
        sendOnChange: true
      }
    ];
  }

  // Plugin webapp routes
  plugin.registerWithRouter = function(router) {
    const express = require('express');
    
    app.debug('registerWithRouter called for MQTT export manager');
    
    // API Routes
    
    // Get current export rules
    router.get('/api/rules', (req, res) => {
      res.json({
        success: true,
        rules: exportRules,
        activeSubscriptions: activeSubscriptions.size,
        mqttConnected: mqttClient ? mqttClient.connected : false
      });
    });

    // Update export rules
    router.post('/api/rules', (req, res) => {
      try {
        const newRules = req.body.rules;
        if (!Array.isArray(newRules)) {
          return res.status(400).json({ success: false, error: 'Rules must be an array' });
        }

        exportRules = newRules;
        plugin.config.exportRules = newRules;
        
        // Save configuration to persistent storage
        app.savePluginOptions(plugin.config, (err) => {
          if (err) {
            app.debug('Error saving plugin configuration:', err);
            return res.status(500).json({ success: false, error: 'Failed to save configuration' });
          }
          
          // Update subscriptions with new rules
          updateSubscriptions();
          
          res.json({ success: true, message: 'Export rules updated and saved' });
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get MQTT connection status
    router.get('/api/mqtt-status', (req, res) => {
      res.json({
        success: true,
        connected: mqttClient ? mqttClient.connected : false,
        broker: plugin.config.mqttBroker,
        clientId: plugin.config.mqttClientId
      });
    });

    // Test MQTT connection
    router.post('/api/test-mqtt', (req, res) => {
      try {
        if (!mqttClient || !mqttClient.connected) {
          return res.status(503).json({ success: false, error: 'MQTT not connected' });
        }

        const testTopic = `${plugin.config.topicPrefix || 'test'}/signalk-mqtt-export-test`;
        const testPayload = JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
          message: 'Test message from SignalK MQTT Export Manager'
        });

        mqttClient.publish(testTopic, testPayload, { qos: 0 });
        res.json({ success: true, message: 'Test message published', topic: testTopic });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Serve static files
    const publicPath = path.join(__dirname, 'public');
    if (fs.existsSync(publicPath)) {
      router.use(express.static(publicPath));
      app.debug('Static files served from:', publicPath);
    }

    app.debug('MQTT Export Manager web routes registered');
  };

  // Configuration schema
  plugin.schema = {
    type: 'object',
    properties: {
      enabled: {
        type: 'boolean',
        title: 'Enable MQTT Export',
        description: 'Enable/disable the MQTT export functionality',
        default: true
      },
      mqttBroker: {
        type: 'string',
        title: 'MQTT Broker URL',
        description: 'MQTT broker connection string (e.g., mqtt://localhost:1883)',
        default: 'mqtt://localhost:1883'
      },
      mqttClientId: {
        type: 'string',
        title: 'MQTT Client ID',
        description: 'Unique client identifier for MQTT connection',
        default: 'signalk-mqtt-export'
      },
      mqttUsername: {
        type: 'string',
        title: 'MQTT Username',
        description: 'Username for MQTT authentication (optional)',
        default: ''
      },
      mqttPassword: {
        type: 'string',
        title: 'MQTT Password',
        description: 'Password for MQTT authentication (optional)',
        default: ''
      },
      topicPrefix: {
        type: 'string',
        title: 'Topic Prefix',
        description: 'Optional prefix for all MQTT topics',
        default: ''
      },
    }
  };

  return plugin;
};