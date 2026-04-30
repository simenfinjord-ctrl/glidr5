// PinSetupView.mc — First-time team PIN entry
// User enters the 4-digit team PIN shown in the Glidr web app (Watch Queue page)

using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.Application.Storage;

class PinSetupView extends WatchUi.View {
    var digits = [0, 0, 0, 0];
    var cursorPos = 0;
    var statusText = "Enter team PIN";
    var isVerifying = false;

    function initialize() {
        View.initialize();
    }

    function onUpdate(dc) {
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.10, Graphics.FONT_SMALL, "GLIDR", Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.22, Graphics.FONT_XTINY, statusText, Graphics.TEXT_JUSTIFY_CENTER);

        // PIN label
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.33, Graphics.FONT_XTINY, "Team PIN", Graphics.TEXT_JUSTIFY_CENTER);

        // Digit boxes
        var digitWidth = 36;
        var totalWidth = digitWidth * 4 + 10;
        var startX = cx - totalWidth / 2;
        var digitY = h * 0.44;

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

            // Underline for active digit only
            if (i == cursorPos) {
                var underlineY = digitY + 30;
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
                dc.setPenWidth(2);
                dc.drawLine(textX - 10, underlineY, textX + 10, underlineY);
                dc.setPenWidth(1);
            }
        }

        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.72, Graphics.FONT_XTINY, "UP/DN: change digit", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, h * 0.80, Graphics.FONT_XTINY, "SELECT: next / confirm", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, h * 0.88, Graphics.FONT_XTINY, "BACK: prev digit", Graphics.TEXT_JUSTIFY_CENTER);
    }

    function getPin() {
        var pin = "";
        for (var i = 0; i < 4; i++) {
            pin += digits[i].toString();
        }
        return pin;
    }
}
