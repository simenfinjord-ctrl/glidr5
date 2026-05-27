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
        var fontH  = Graphics.getFontHeight(Graphics.FONT_XTINY);
        var barH   = (fontH * 1.5).toNumber();
        var barTop = (h * 0.15).toNumber() + index * (h * 0.155).toNumber() - (barH / 2).toNumber();
        var textY  = barTop + ((barH - fontH) / 2).toNumber();
        var isSelected = (index == selectedIndex);

        if (isSelected) {
            dc.setColor(Ld.accentColor(), Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(cx - Ld.hx(w), barTop, Ld.fw(w), barH, Ld.cr(w));
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        } else {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        }

        dc.drawText(cx - w * 0.18, textY, Graphics.FONT_XTINY, label, Graphics.TEXT_JUSTIFY_CENTER);

        var statusColor = isOn ? Graphics.COLOR_GREEN : Graphics.COLOR_RED;
        if (!isSelected) { statusColor = isOn ? Graphics.COLOR_GREEN : Graphics.COLOR_DK_RED; }
        dc.setColor(statusColor, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx + w * 0.22, textY, Graphics.FONT_XTINY, isOn ? "ON" : "OFF", Graphics.TEXT_JUSTIFY_CENTER);
    }

    function drawActionItem(dc, w, h, cx, index, label, color) {
        var fontH  = Graphics.getFontHeight(Graphics.FONT_XTINY);
        var barH   = (fontH * 1.5).toNumber();
        var barTop = (h * 0.15).toNumber() + index * (h * 0.155).toNumber() - (barH / 2).toNumber();
        var textY  = barTop + ((barH - fontH) / 2).toNumber();
        var isSelected = (index == selectedIndex);

        if (isSelected) {
            dc.setColor(Ld.accentColor(), Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(cx - Ld.hx(w), barTop, Ld.fw(w), barH, Ld.cr(w));
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        } else {
            dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        }

        dc.drawText(cx, textY, Graphics.FONT_XTINY, label, Graphics.TEXT_JUSTIFY_CENTER);
    }
}
