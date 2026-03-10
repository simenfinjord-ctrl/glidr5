using Toybox.WatchUi;
using Toybox.Graphics;

class CodeEntryView extends WatchUi.View {
    var digits as Array<Number> = [0, 0, 0, 0, 0, 0];
    var cursorPos as Number = 0;
    var statusText as String = "Enter session code";
    var isConnecting as Boolean = false;

    function initialize() {
        View.initialize();
    }

    function onUpdate(dc as Dc) as Void {
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.15, Graphics.FONT_SMALL, "GLIDR", Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.28, Graphics.FONT_XTINY, statusText, Graphics.TEXT_JUSTIFY_CENTER);

        var digitWidth = 28;
        var totalWidth = digitWidth * 6 + 10;
        var startX = cx - totalWidth / 2;
        var digitY = h * 0.45;

        for (var i = 0; i < 6; i++) {
            var dx = startX + i * digitWidth + (i >= 3 ? 10 : 0);

            if (i == cursorPos) {
                dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
                dc.fillRoundedRectangle(dx - 2, digitY - 4, digitWidth - 4, 30, 4);
                dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_TRANSPARENT);
            } else {
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            }

            dc.drawText(dx + digitWidth / 2 - 2, digitY, Graphics.FONT_NUMBER_MILD,
                digits[i].toString(), Graphics.TEXT_JUSTIFY_CENTER);
        }

        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.72, Graphics.FONT_XTINY, "UP/DN: change digit", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, h * 0.80, Graphics.FONT_XTINY, "SELECT: next / connect", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, h * 0.88, Graphics.FONT_XTINY, "BACK: prev digit", Graphics.TEXT_JUSTIFY_CENTER);
    }

    function getCode() as String {
        var code = "";
        for (var i = 0; i < 6; i++) {
            code += digits[i].toString();
        }
        return code;
    }
}
