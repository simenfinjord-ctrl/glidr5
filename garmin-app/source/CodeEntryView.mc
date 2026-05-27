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

        Ld.drawDigitRow(dc, w, (h * 0.50).toNumber(), digits, cursorPos);

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
