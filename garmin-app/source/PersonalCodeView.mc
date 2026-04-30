// PersonalCodeView.mc — Enter your personal 4-digit watch code
// The code is shown in "My Account" in the Glidr web app.
// Once entered, your name will appear in Live Runsheet.

using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.Application.Storage;

class PersonalCodeView extends WatchUi.View {
    var digits = [0, 0, 0, 0];
    var cursorPos = 0;
    var statusText = "Enter your code";
    var isVerifying = false;

    function initialize() {
        View.initialize();
        // Pre-fill with existing code if stored
        var existing = Storage.getValue("userCode");
        if (existing != null && existing.length() == 4) {
            for (var i = 0; i < 4; i++) {
                digits[i] = existing.substring(i, i + 1).toNumber();
            }
        }
    }

    function onUpdate(dc) {
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.06, Graphics.FONT_SMALL, "MY CODE", Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.20, Graphics.FONT_XTINY, statusText, Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.30, Graphics.FONT_XTINY, "Personal code", Graphics.TEXT_JUSTIFY_CENTER);

        // Digit boxes
        var digitWidth = 36;
        var totalWidth = digitWidth * 4 + 10;
        var startX = cx - totalWidth / 2;
        var digitY = h * 0.40;

        for (var i = 0; i < 4; i++) {
            var dx = startX + i * digitWidth + (i >= 2 ? 10 : 0);
            var textX = dx + digitWidth / 2;

            if (i == cursorPos) {
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            } else {
                dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            }

            dc.drawText(textX, digitY, Graphics.FONT_NUMBER_MILD,
                digits[i].toString(), Graphics.TEXT_JUSTIFY_CENTER);

            if (i == cursorPos) {
                var underlineY = digitY + 30;
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
                dc.setPenWidth(2);
                dc.drawLine(textX - 10, underlineY, textX + 10, underlineY);
                dc.setPenWidth(1);
            }
        }

        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.65, Graphics.FONT_XTINY, "UP/DN: change digit", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, h * 0.73, Graphics.FONT_XTINY, "SELECT: next / confirm", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, h * 0.81, Graphics.FONT_XTINY, "BACK: prev / cancel", Graphics.TEXT_JUSTIFY_CENTER);

        // Show stored name if verified
        var storedName = Storage.getValue("userName");
        if (storedName != null) {
            dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.89, Graphics.FONT_XTINY, storedName, Graphics.TEXT_JUSTIFY_CENTER);
        }
    }

    function getCode() {
        var code = "";
        for (var i = 0; i < 4; i++) {
            code += digits[i].toString();
        }
        return code;
    }
}
