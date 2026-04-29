using Toybox.WatchUi;
using Toybox.Graphics;

class CodeEntryView extends WatchUi.View {
    var digits = [0, 0, 0, 0];
    var cursorPos = 0;
    var statusText = "Enter session code";
    var isConnecting = false;

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
        dc.drawText(cx, h * 0.15, Graphics.FONT_SMALL, "GLIDR", Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.28, Graphics.FONT_XTINY, statusText, Graphics.TEXT_JUSTIFY_CENTER);

        var digitWidth = 36;
        var totalWidth = digitWidth * 4 + 10;
        var startX = cx - totalWidth / 2;
        var digitY = h * 0.45;

        for (var i = 0; i < 4; i++) {
            var dx = startX + i * digitWidth + (i >= 2 ? 10 : 0);

            var textX = dx + digitWidth / 2;
            var rectW = 24;
            if (i == cursorPos) {
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
                dc.fillRoundedRectangle(textX - rectW / 2, digitY - 5, rectW, 34, 5);
                dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_TRANSPARENT);
            } else {
                dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            }

            dc.drawText(textX, digitY, Graphics.FONT_NUMBER_MILD,
                digits[i].toString(), Graphics.TEXT_JUSTIFY_CENTER);
        }

        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.72, Graphics.FONT_XTINY, "UP/DN: change digit", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, h * 0.80, Graphics.FONT_XTINY, "SELECT: next / connect", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, h * 0.88, Graphics.FONT_XTINY, "BACK: prev digit", Graphics.TEXT_JUSTIFY_CENTER);
    }

    function getCode() {
        var code = "";
        for (var i = 0; i < 4; i++) {
            code += digits[i].toString();
        }
        return code;
    }
}
