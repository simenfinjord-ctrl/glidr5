# Glidr Runsheet — Garmin Connect IQ App

Control ski test runsheets from your Garmin watch. Works with the Glidr web app's "Complete Runsheet" feature.

## How It Works

1. Open a new test in Glidr web app and click "Complete Runsheet"
2. Click the "Watch" button to start a watch session — a 6-digit code appears
3. On your Garmin watch, open the Glidr Runsheet app
4. Enter the 6-digit code using UP/DOWN buttons
5. The watch shows each heat (e.g., "Par 1 vs Par 2")
6. Press UP to select the top pair as winner, DOWN for the bottom pair
7. Use UP/DOWN to set the loser's distance (cm behind), then SELECT to confirm
8. Results appear live on the web app bracket view
9. Repeat until all heats are done

## Watch Controls

### Code Entry Screen
- **UP/DOWN**: Change current digit (0-9)
- **SELECT**: Move to next digit / Connect (on last digit)
- **BACK**: Move to previous digit

### Heat Screen
- **UP**: Select top pair (Par A) as winner
- **DOWN**: Select bottom pair (Par B) as winner

### Distance Entry Screen
- **UP**: Increase distance by 1 cm
- **DOWN**: Decrease distance by 1 cm
- **SELECT**: Confirm and submit result
- **BACK**: Go back to winner selection

## Setup

### Prerequisites
- [Garmin Connect IQ SDK](https://developer.garmin.com/connect-iq/sdk/) (v6.0+)
- Visual Studio Code with the [Monkey C extension](https://marketplace.visualstudio.com/items?itemName=garmin.monkey-c)

### Configure Server URL
Edit `source/ServerConfig.mc` and replace the URL with your deployed Glidr app URL:
```
const BASE_URL = "https://your-app-name.replit.app";
```

### Build
```bash
# From the garmin-app directory
monkeyc -f monkey.jungle -o bin/GlidrRunsheet.prg -d fenix7 -y /path/to/developer_key.der
```

### Install on Watch
1. Connect your Garmin watch via USB
2. Copy `bin/GlidrRunsheet.prg` to `GARMIN/APPS/` on the watch
3. Or use the Connect IQ simulator for testing

## Supported Devices
- Fenix 7 / 7S / 7X / 8
- Forerunner 945 / 955 / 965 / 265
- Epix 2
- Venu 2 / 2S / 3 / 3S

Add more devices by editing `manifest.xml`.

## API Endpoints Used

The watch communicates with these server endpoints:

- `GET /api/runsheet/watch/:code` — Get current heat info
- `POST /api/runsheet/watch/:code/result` — Submit heat result
  - Body: `{ roundIndex, heatIndex, winnerPair, loserDistance }`
