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

### Method 2: NPM Installation from GitHhun repor
```bash
cd ~/.signalk/node_modules
npm install  motamman/zennora-signalk-mqtt-export
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

## Web Interface

Access the management interface at: (check if https and port 3000)
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
- `vessels/urn_mrn_imo_mmsi_123456789/navigation/position`
- `vessels/urn_mrn_imo_mmsi_123456789/navigation/position`
- `vessels/urn_mrn_imo_mmsi_123456789/electrical/batteries/house/voltage`

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

## License

MIT License - See [LICENSE](../LICENSE) file for details.

## Support

For issues and feature requests:
- **Plugin Issues**: Report via GitHub issues
- **SignalK Integration**: Check SignalK documentation
- **MQTT Issues**: Consult MQTT broker documentation