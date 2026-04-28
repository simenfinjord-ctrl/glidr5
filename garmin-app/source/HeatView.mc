using Toybox.WatchUi;
using Toybox.Graphics;

class HeatView extends WatchUi.View {
    var sessionCode;
    var roundName = "";
    var pairA = 0;
    var pairB = 0;
    var roundIndex = 0;
    var heatIndex = 0;
    var statusText = "Loading...";
    var allDone = false;

    var selectedWinner = 0;
    var phase = 0;

    var distance = 0;
    var isSending = false;

    function initialize(code) {
        View.initialize();
        sessionCode = code;
    }

    function onUpdate(dc) {
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        if (allDone) {
            dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.35, Graphics.FONT_MEDIUM, "DONE!", Graphics.TEXT_JUSTIFY_CENTER);
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.55, Graphics.FONT_SMALL, "All heats complete", Graphics.TEXT_JUSTIFY_CENTER);
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.70, Graphics.FONT_XTINY, "BACK to exit", Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        if (isSending) {
            dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.45, Graphics.FONT_SMALL, "Sending...", Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.08, Graphics.FONT_XTINY, roundName, Graphics.TEXT_JUSTIFY_CENTER);

        if (phase == 0) {
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.20, Graphics.FONT_SMALL, "Select winner", Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.38, Graphics.FONT_MEDIUM, "Par " + pairA.toString(), Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.53, Graphics.FONT_SMALL, "vs", Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.65, Graphics.FONT_MEDIUM, "Par " + pairB.toString(), Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.82, Graphics.FONT_XTINY, "UP = Par " + pairA.toString(), Graphics.TEXT_JUSTIFY_CENTER);
            dc.drawText(cx, h * 0.90, Graphics.FONT_XTINY, "DOWN = Par " + pairB.toString(), Graphics.TEXT_JUSTIFY_CENTER);

        } else if (phase == 1) {
            var loserPair = (selectedWinner == pairA) ? pairB : pairA;

            dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.18, Graphics.FONT_SMALL, "Par " + selectedWinner.toString() + " wins", Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.33, Graphics.FONT_SMALL, "Par " + loserPair.toString() + " behind:", Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.50, Graphics.FONT_NUMBER_HOT, distance.toString(), Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.72, Graphics.FONT_XTINY, "cm", Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.82, Graphics.FONT_XTINY, "UP/DN: +/- 10 cm", Graphics.TEXT_JUSTIFY_CENTER);
            dc.drawText(cx, h * 0.90, Graphics.FONT_XTINY, "SELECT: confirm", Graphics.TEXT_JUSTIFY_CENTER);
        }
    }
}
