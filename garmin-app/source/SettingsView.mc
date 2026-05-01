// SettingsView.mc — App settings: vibration, key sounds, my code, change PIN, log out

using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.Application.Storage;

class SettingsView extends WatchUi.View {
    var selectedIndex = 0;
    var vibrateOn = true;
    var keySoundsOn = true;
    // 5 items: 0=Vibrate, 1=Key Sounds, 2=My Code, 3=Change PIN, 4=Log Out

    function initialize() {
        View.initialize();
        var v = Storage.getValue("vibrate");
        vibrateOn = (v == null) ? true : v;
        var k = Storage.getValue("keySounds");
        keySoundsOn = (k == null) ? true : k;
    }

    function onUpdate(dc) {
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.03, Graphics.FONT_SMALL, "SETTINGS", Graphics.TEXT_JUSTIFY_CENTER);

        // Item 0: Vibrate
        drawToggleItem(dc, w, h, cx, 0, "Vibrate", vibrateOn);
        // Item 1: Key Sounds
        drawToggleItem(dc, w, h, cx, 1, "Key Sounds", keySoundsOn);
        // Item 2: My Code
        var storedCode = Storage.getValue("userCode");
        var myCodeLabel = (storedCode != null) ? ("My Code: " + storedCode) : "My Code: --";
        drawActionItem(dc, w, h, cx, 2, myCodeLabel, Graphics.COLOR_LT_GRAY);
        // Item 3: Change PIN
        drawActionItem(dc, w, h, cx, 3, "Change Team PIN", Graphics.COLOR_LT_GRAY);
        // Item 4: Log Out
        drawActionItem(dc, w, h, cx, 4, "Log Out", Graphics.COLOR_RED);

        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.95, Graphics.FONT_XTINY, "UP/DN: navigate  SELECT: open", Graphics.TEXT_JUSTIFY_CENTER);
    }

    function drawToggleItem(dc, w, h, cx, index, label, isOn) {
        var itemY = h * 0.15 + index * (h * 0.155);
        var isSelected = (index == selectedIndex);

        if (isSelected) {
            dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(cx - w * 0.42, itemY - 4, w * 0.84, 28, 6);
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        } else {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        }

        dc.drawText(cx - w * 0.18, itemY + 1, Graphics.FONT_XTINY, label, Graphics.TEXT_JUSTIFY_CENTER);

        var statusColor = isOn ? Graphics.COLOR_GREEN : Graphics.COLOR_RED;
        if (!isSelected) { statusColor = isOn ? Graphics.COLOR_GREEN : Graphics.COLOR_DK_RED; }
        dc.setColor(statusColor, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx + w * 0.22, itemY + 1, Graphics.FONT_XTINY, isOn ? "ON" : "OFF", Graphics.TEXT_JUSTIFY_CENTER);
    }

    function drawActionItem(dc, w, h, cx, index, label, color) {
        var itemY = h * 0.15 + index * (h * 0.155);
        var isSelected = (index == selectedIndex);

        if (isSelected) {
            dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(cx - w * 0.42, itemY - 4, w * 0.84, 28, 6);
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        } else {
            dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        }

        dc.drawText(cx, itemY + 1, Graphics.FONT_XTINY, label, Graphics.TEXT_JUSTIFY_CENTER);
    }
}
