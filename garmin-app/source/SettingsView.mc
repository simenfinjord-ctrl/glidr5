// SettingsView.mc — App settings: vibration, key sounds, change PIN

using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.Application.Storage;

class SettingsView extends WatchUi.View {
    var selectedIndex = 0;
    var vibrateOn = true;
    var keySoundsOn = true;

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
        dc.drawText(cx, h * 0.05, Graphics.FONT_SMALL, "SETTINGS", Graphics.TEXT_JUSTIFY_CENTER);

        // Item 0: Vibrate
        drawToggleItem(dc, w, h, cx, 0, "Vibrate", vibrateOn);
        // Item 1: Key Sounds
        drawToggleItem(dc, w, h, cx, 1, "Key Sounds", keySoundsOn);
        // Item 2: Change PIN
        drawActionItem(dc, w, h, cx, 2, "Change PIN");

        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.90, Graphics.FONT_XTINY, "UP/DN: navigate  SELECT: toggle/open", Graphics.TEXT_JUSTIFY_CENTER);
    }

    function drawToggleItem(dc, w, h, cx, index, label, isOn) {
        var itemY = h * 0.25 + index * (h * 0.20);
        var isSelected = (index == selectedIndex);

        if (isSelected) {
            dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(cx - w * 0.42, itemY - 4, w * 0.84, 36, 6);
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        } else {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        }

        // Label on the left
        dc.drawText(cx - w * 0.18, itemY + 4, Graphics.FONT_XTINY, label, Graphics.TEXT_JUSTIFY_CENTER);

        // Status on the right
        var statusColor = isOn ? Graphics.COLOR_GREEN : Graphics.COLOR_RED;
        if (!isSelected) { statusColor = isOn ? Graphics.COLOR_GREEN : Graphics.COLOR_DK_RED; }
        dc.setColor(statusColor, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx + w * 0.22, itemY + 4, Graphics.FONT_XTINY, isOn ? "ON" : "OFF", Graphics.TEXT_JUSTIFY_CENTER);
    }

    function drawActionItem(dc, w, h, cx, index, label) {
        var itemY = h * 0.25 + index * (h * 0.20);
        var isSelected = (index == selectedIndex);

        if (isSelected) {
            dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(cx - w * 0.42, itemY - 4, w * 0.84, 36, 6);
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        } else {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        }

        dc.drawText(cx, itemY + 4, Graphics.FONT_XTINY, label, Graphics.TEXT_JUSTIFY_CENTER);
    }
}
