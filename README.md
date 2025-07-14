# Zennora SignalK MQTT Export Manager

**Version 0.1.0**

A comprehensive SignalK plugin that provides a web-based interface for managing selective export of SignalK data to MQTT brokers. This plugin replaces complex Node-RED flows with a clean, manageable interface.

## Features

- **🌐 Web Interface**: Easy-to-use webapp for managing export rules
- **📋 Rule Management**: Create, edit, enable/disable export rules
- **🎯 Selective Export**: Export only the data you need with flexible filtering
- **📊 Real-time Status**: Monitor MQTT connection and active subscriptions
- **🔄 Dynamic Updates**: Changes take effect immediately without restart
- **💾 Persistent Configuration**: Rules are saved to SignalK configuration and survive restarts
- **🏷️ Flexible Topics**: Customizable MQTT topic templates
- **📦 Multiple Formats**: Export full SignalK structure or values only
- **🔍 Source Filtering**: Filter by specific SignalK data sources
- **🚫 MMSI Exclusion**: Exclude specific vessel MMSIs from export rules
- **⚡ Send on Change**: Reduce MQTT traffic by only sending when values change

## Installation

### Method 1: Manual Installation
```bash
# Copy to SignalK plugins directory
cp -r zennora-signalk-mqtt-export ~/.signalk/node_modules/

# Install dependencies
cd ~/.signalk/node_modules/zennora-signalk-mqtt-export
npm install

# Restart SignalK
sudo systemctl restart signalk
```

### Method 2: NPM Installation (Future)
```bash
cd ~/.signalk
npm install zennora-signalk-mqtt-export
sudo systemctl restart signalk
```

## Configuration

Navigate to **SignalK Admin → Server → Plugin Config → Zennora MQTT Export Manager**

### Basic Settings
- **Enable MQTT Export**: Master enable/disable switch
- **MQTT Broker URL**: Connection string (e.g., `mqtt://localhost:1883`)
- **Client ID**: Unique identifier for the MQTT connection
- **Username/Password**: Optional authentication credentials
- **Topic Prefix**: Optional prefix for all MQTT topics

### Export Rules
The plugin comes with default rules based on common marine data patterns:
- **All Navigation Data**: Exports all navigation paths from your vessel
- **Derived Data**: Calculated values from various sources
- **PyPilot Data**: Autopilot information
- **Anchor Alarm**: Anchor monitoring data
- **All Vessels (AIS)**: Data from other vessels (with MMSI exclusion)
- **AIS Vessels**: Specifically AIS targets from other vessels

## Web Interface

Access the management interface at:
- **https://your-signalk-server:3443/plugins/zennora-signalk-mqtt-export/**

### Interface Features

#### Status Dashboard
- **MQTT Connection**: Real-time connection status
- **Active Rules**: Number of enabled export rules
- **Active Subscriptions**: Number of active SignalK subscriptions
- **Total Rules**: Total number of configured rules

#### Rule Management
- **Add Rule**: Create new export rules
- **Edit Rule**: Modify existing rules
- **Enable/Disable**: Toggle rules on/off
- **Delete Rule**: Remove unwanted rules
- **Save Changes**: Apply changes to active configuration

#### Rule Configuration Options
- **Name**: Descriptive name for the rule
- **Context**: SignalK context (`vessels.self`, `vessels.*`, `vessels.urn:*`)
- **Path**: SignalK path with wildcard support (`navigation.position`, `navigation*`, `electrical.batteries.*`)
- **Source Filter**: Optional source filter (e.g., `derived-data`, `pypilot`)
- **Update Period**: How often to check for updates (ms)
- **MQTT QoS**: Quality of Service level (0, 1, 2)
- **Payload Format**: Full SignalK structure or value only
- **Topic Template**: Custom MQTT topic format
- **Exclude MMSIs**: Comma-separated list of MMSIs to exclude (e.g., `368396230`)
- **Send on Change Only**: Only publish when values change (reduces MQTT traffic)
- **Retain**: Set MQTT retain flag

## MQTT Topic Structure

### Default Topic Format
```
[prefix/]context/path
```

Examples:
- `vessels/self/navigation/position`
- `vessels/urn_mrn_imo_mmsi_123456789/navigation/position`
- `vessels/self/electrical/batteries/house/voltage`

### Custom Topic Templates
Use placeholders in topic templates:
- `{context}`: SignalK context
- `{path}`: SignalK path

Example templates:
- `marine/{context}/{path}`
- `signalk/data/{context}/{path}`
- `boat/sensors/{path}`

## Payload Formats

### Full SignalK Structure
```json
{
  "context": "vessels.self",
  "path": "navigation.position",
  "value": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "altitude": 0
  },
  "timestamp": "2025-07-11T10:30:00.000Z",
  "source": {
    "label": "GPS",
    "type": "NMEA2000"
  }
}
```

### Value Only
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "altitude": 0
}
```

## Replacing Node-RED Flow

This plugin is designed to replace complex Node-RED flows like the one you showed. Here's how to migrate:

### Before (Node-RED)
- Multiple SignalK subscription nodes
- Complex parsing functions
- Manual topic construction
- Difficult to manage and modify

### After (This Plugin)
- Single plugin with web interface
- Visual rule management
- Automatic topic generation
- Easy to enable/disable specific exports
- No coding required for changes

### Migration Steps
1. **Install the plugin**
2. **Configure MQTT broker settings**
3. **Review default rules** (they match your existing flow)
4. **Customize rules** as needed via the web interface
5. **Test MQTT output** using the built-in test function
6. **Disable Node-RED flow** once confirmed working

## Default Export Rules

The plugin comes with practical rules for common marine data export:

1. **All Navigation Data** - `vessels.self/navigation*` from all sources
2. **Derived Data** - `vessels.self/*` from `derived-data` source
3. **PyPilot Data** - `vessels.self/*` from `pypilot` source  
4. **Anchor Alarm** - `vessels.self/*` from `anchoralarm` source
5. **All Vessels (AIS)** - `vessels.*/*` from all sources (with MMSI exclusion)
6. **AIS Vessels** - `vessels.urn:*/*` from all sources (with MMSI exclusion)

### Path Wildcard Support
- `navigation*` - Matches all navigation paths (`navigation.position`, `navigation.headingTrue`, etc.)
- `electrical.batteries.*` - Matches all battery-related paths
- `*` - Matches all paths (use with caution)

## API Endpoints

The plugin provides REST API endpoints for integration:

### Get Rules
```bash
GET /plugins/zennora-signalk-mqtt-export/api/rules
```

### Update Rules
```bash
POST /plugins/zennora-signalk-mqtt-export/api/rules
Content-Type: application/json

{
  "rules": [...]
}
```

### MQTT Status
```bash
GET /plugins/zennora-signalk-mqtt-export/api/mqtt-status
```

### Test MQTT
```bash
POST /plugins/zennora-signalk-mqtt-export/api/test-mqtt
```

## Troubleshooting

### MQTT Connection Issues
1. **Check broker URL**: Ensure the MQTT broker is accessible
2. **Verify credentials**: Check username/password if authentication is required
3. **Network connectivity**: Ensure SignalK server can reach the MQTT broker
4. **Firewall**: Check if MQTT port (usually 1883) is open

### No Data Being Exported
1. **Check rule status**: Ensure rules are enabled
2. **Verify SignalK data**: Check if the specified paths have data in SignalK
3. **Source filtering**: Ensure source filters match actual data sources
4. **Path wildcards**: Ensure wildcard patterns match correctly (`navigation*` vs `navigation.*`)
5. **Check logs**: Look at SignalK logs for error messages

### Configuration Not Persisting
1. **Save changes**: Always click "Save Changes" in the webapp
2. **Check permissions**: Ensure SignalK has write permissions to its configuration directory
3. **Restart SignalK**: Configuration changes are saved but require restart to take full effect

### Performance Issues
1. **Use "Send on Change"**: Enable this option to reduce MQTT traffic significantly
2. **Reduce update periods**: Increase the period value for high-frequency data
3. **Limit wildcards**: Be specific with paths instead of using `*`
4. **Monitor resource usage**: Check CPU and memory usage

## Advanced Usage

### Custom Topic Templates
Create custom topic structures for specific use cases:
```
marine/vessel/{context}/sensor/{path}
iot/boat/data/{path}
signalk/{context}/{path}/current
```

### Source Filtering
Filter data by specific sources to avoid duplicates:
- `derived-data` - Only calculated/derived values
- `pypilot` - Only data from PyPilot autopilot system
- `anchoralarm` - Only data from anchor alarm system
- Leave empty for all sources

### MMSI Exclusion
Exclude specific vessel MMSIs from export rules:
- Useful for preventing your own vessel's data from being exported in AIS rules
- Enter comma-separated MMSIs: `368396230, 123456789`
- Commonly used with `vessels.*` or `vessels.urn:*` contexts

### Send on Change Only
Significantly reduces MQTT traffic by only publishing when values change:
- Filters out duplicate values automatically
- Particularly useful for high-frequency data like GPS positions
- Recommended for most use cases to reduce bandwidth

### QoS Settings
- **QoS 0**: At most once delivery (fastest, may lose messages)
- **QoS 1**: At least once delivery (reliable, may duplicate)
- **QoS 2**: Exactly once delivery (slowest, guaranteed unique)

## Integration Examples

### Home Assistant
```yaml
sensor:
  - platform: mqtt
    name: "Boat Position"
    state_topic: "vessels/self/navigation/position"
    value_template: "{{ value_json.value.latitude }},{{ value_json.value.longitude }}"
```

### Node-RED (Consumption)
```json
{
  "id": "mqtt-in",
  "type": "mqtt in",
  "topic": "vessels/self/+/+",
  "broker": "mqtt-broker"
}
```

### Grafana
Use MQTT data source to visualize marine data in real-time dashboards.

## License

MIT License - See [LICENSE](../LICENSE) file for details.

## Support

For issues and feature requests:
- **Plugin Issues**: Report via GitHub issues
- **SignalK Integration**: Check SignalK documentation
- **MQTT Issues**: Consult MQTT broker documentation