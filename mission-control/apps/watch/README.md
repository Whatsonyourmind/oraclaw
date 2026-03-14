# ORACLE Watch App

Apple Watch companion app for the ORACLE system.

## Setup

### Prerequisites
- Xcode 15+ with WatchKit support
- iOS app configured with App Group for data sharing
- Watch Connectivity framework enabled

### Directory Structure

```
apps/watch/
├── src/
│   ├── WatchBridge.ts       # Phone-side bridge communication
│   └── types.ts             # Shared types
├── ios/                     # Native iOS WatchKit files (created by Xcode)
│   ├── OracleWatch/         # Watch app target
│   │   ├── OracleWatchApp.swift
│   │   └── ContentView.swift
│   ├── OracleWatch Extension/
│   │   ├── ExtensionDelegate.swift
│   │   ├── InterfaceController.swift
│   │   ├── ComplicationController.swift
│   │   └── NotificationController.swift
│   └── Assets.xcassets/
└── README.md
```

### iOS Project Configuration

Add to your iOS app's `Info.plist`:
```xml
<key>WKCompanionAppBundleIdentifier</key>
<string>com.missioncontrol.oracle.watchkitapp</string>
```

Add to your Watch App's `Info.plist`:
```xml
<key>WKCompanionAppBundleIdentifier</key>
<string>com.missioncontrol.oracle</string>
<key>NSExtension</key>
<dict>
    <key>NSExtensionAttributes</key>
    <dict>
        <key>WKAppBundleIdentifier</key>
        <string>com.missioncontrol.oracle.watchkitapp</string>
    </dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.watchkit</string>
</dict>
```

### App Groups

Configure App Groups for shared data:
1. Go to Signing & Capabilities in Xcode
2. Add "App Groups" capability to both iOS and Watch targets
3. Use group identifier: `group.com.missioncontrol.oracle`

### Dependencies

The phone app requires:
```json
{
  "react-native-watch-connectivity": "^1.1.0"
}
```

## Bridge Communication

### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `SYNC_STATE` | Phone → Watch | Full ORACLE state sync |
| `UPDATE_PHASE` | Phone → Watch | OODA phase change |
| `NEW_SIGNAL` | Phone → Watch | New signal detected |
| `GHOST_ACTION` | Phone → Watch | Ghost action ready |
| `STEP_UPDATE` | Phone → Watch | Execution step update |
| `SCAN_REQUEST` | Watch → Phone | User requests radar scan |
| `APPROVE_ACTION` | Watch → Phone | User approves ghost action |
| `COMPLETE_STEP` | Watch → Phone | User completes step |
| `DISMISS_SIGNAL` | Watch → Phone | User dismisses signal |
| `COMPLICATION_UPDATE` | Phone → Watch | Complication data refresh |
| `SETTINGS_SYNC` | Bidirectional | Settings synchronization |

### Usage Example

```typescript
import { useWatchConnectivity } from '@/watch/src/WatchBridge';

function OracleScreen() {
  const {
    isPaired,
    isReachable,
    isWatchAppInstalled,
    syncOracleState,
    subscribeToMessages,
  } = useWatchConnectivity();

  useEffect(() => {
    const unsubscribe = subscribeToMessages('SCAN_REQUEST', (message) => {
      console.log('Watch requested scan');
      // Trigger radar scan
    });

    return () => unsubscribe();
  }, []);

  // Sync state when data changes
  useEffect(() => {
    if (isReachable) {
      syncOracleState({
        currentPhase: 'observe',
        phaseColor: '#00BFFF',
        topSignal: { id: '1', title: 'Deadline approaching', urgency: 'high' },
        currentStep: null,
        pendingGhostActions: 2,
        planProgress: 0,
        lastUpdated: Date.now(),
      });
    }
  }, [isReachable]);

  return (
    <View>
      <Text>Watch paired: {isPaired ? 'Yes' : 'No'}</Text>
      <Text>Watch app installed: {isWatchAppInstalled ? 'Yes' : 'No'}</Text>
      <Text>Reachable: {isReachable ? 'Yes' : 'No'}</Text>
    </View>
  );
}
```

## Complications

ORACLE supports the following complication families:

### Modular Small
- Displays current OODA phase icon with color

### Modular Large
- Phase indicator
- Top signal title
- Plan progress bar

### Circular Small
- Phase color ring
- Phase initial (O/R/D/A)

### Graphic Corner
- Phase gauge with progress

### Graphic Rectangular
- Full mini dashboard
- Phase + top signal + pending actions

## Notifications

The Watch app handles push notifications for:
- Critical signals (haptic alert)
- Ghost action approvals
- Step completion reminders
- Plan blockers

## Testing

1. Build and run the iOS app with Watch target selected
2. Ensure Watch Simulator is paired with iOS Simulator
3. Use Console.app to view Watch logs
4. Test with both reachable and non-reachable states
