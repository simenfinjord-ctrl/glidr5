#!/bin/bash
# deploy.sh — bygg og installer GlidrRunsheet på koblet Garmin-klokke

SDK_DIR=~/Library/Application\ Support/Garmin/ConnectIQ/Sdks
KEY=~/Desktop/developer_key.der
PRG=bin/GlidrRunsheet.prg
DEVICE=fr945

# Finn nyeste SDK automatisk
SDK=$(ls -d "${SDK_DIR}"/connectiq-sdk-mac-8.4.1* 2>/dev/null | head -1)
if [ -z "$SDK" ]; then
  SDK=$(ls -d "${SDK_DIR}"/connectiq-sdk-mac-* 2>/dev/null | sort -V | tail -1)
fi

if [ -z "$SDK" ]; then
  echo "❌ Fant ikke Connect IQ SDK i $SDK_DIR"
  exit 1
fi

echo "📦 Bygger med SDK: $(basename $SDK)"
"$SDK/bin/monkeyc" -f monkey.jungle -o "$PRG" -d "$DEVICE" -y "$KEY" -l 0

if [ $? -ne 0 ]; then
  echo "❌ Bygg feilet!"
  exit 1
fi

echo "✅ Bygg vellykket: $PRG"

# Finn koblet Garmin-klokke
GARMIN_VOL=$(find /Volumes -maxdepth 2 -name "GARMIN" -type d 2>/dev/null | head -1 | xargs dirname 2>/dev/null)
if [ -z "$GARMIN_VOL" ]; then
  echo ""
  echo "⚠️  Klokken er ikke koblet til via USB."
  echo "   Koble til klokken og kjør scriptet på nytt, ELLER"
  echo "   kopier filen manuelt:"
  echo "   cp $PRG /Volumes/[KLOKKENAVN]/GARMIN/Apps/"
  exit 0
fi

APPS_DIR="$GARMIN_VOL/GARMIN/Apps"
if [ ! -d "$APPS_DIR" ]; then
  mkdir -p "$APPS_DIR"
fi

echo "📲 Kopierer til $APPS_DIR..."
cp "$PRG" "$APPS_DIR/GlidrRunsheet.prg"

if [ $? -eq 0 ]; then
  echo "✅ Installert! Løs ut klokken trygt i Finder og start appen."
else
  echo "❌ Kopiering feilet. Sjekk at klokken er koblet til og ikke låst."
fi
