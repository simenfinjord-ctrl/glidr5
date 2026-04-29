using Toybox.WatchUi;
using Toybox.Graphics;

class HeatView extends WatchUi.View {
    var sessionCode;
    var roundName = "";
    var pairA = 0;
    var pairB = 0;
    var labelA = "";
    var labelB = "";
    var roundIndex = 0;
    var heatIndex = 0;
    var statusText = "Loading...";
    var allDone = false;

    var selectedWinner = 0;
    var selectedLabel = "";
    var loserLabel = "";
    var phase = 0;

    var distance = 0;
    var isSending = false;
    var isApplying = false;
    var applied = false;

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
            if (applied) {
                dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, h * 0.35, Graphics.FONT_MEDIUM, "APPLIED!", Graphics.TEXT_JUSTIFY_CENTER);
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, h * 0.55, Graphics.FONT_SMALL, "Results saved", Graphics.TEXT_JUSTIFY_CENTER);
                dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, h * 0.70, Graphics.FONT_XTINY, "BACK to exit", Graphics.TEXT_JUSTIFY_CENTER);
            } else if (isApplying) {
                dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, h * 0.45, Graphics.FONT_SMALL, "Saving...", Graphics.TEXT_JUSTIFY_CENTER);
            } else {
                dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, h * 0.25, Graphics.FONT_MEDIUM, "DONE!", Graphics.TEXT_JUSTIFY_CENTER);
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, h * 0.45, Graphics.FONT_SMALL, "All heats complete", Graphics.TEXT_JUSTIFY_CENTER);
                dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, h * 0.62, Graphics.FONT_XTINY, "SELECT: apply results", Graphics.TEXT_JUSTIFY_CENTER);
                dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, h * 0.75, Graphics.FONT_XTINY, "BACK to exit", Graphics.TEXT_JUSTIFY_CENTER);
            }
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
            dc.drawText(cx, h * 0.38, Graphics.FONT_MEDIUM, labelA, Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.53, Graphics.FONT_SMALL, "vs", Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.65, Graphics.FONT_MEDIUM, labelB, Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.82, Graphics.FONT_XTINY, "UP = " + labelA, Graphics.TEXT_JUSTIFY_CENTER);
            dc.drawText(cx, h * 0.90, Graphics.FONT_XTINY, "DOWN = " + labelB, Graphics.TEXT_JUSTIFY_CENTER);

        } else if (phase == 1) {
            dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.10, Graphics.FONT_SMALL, selectedLabel + " wins", Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.28, Graphics.FONT_XTINY, loserLabel + " behind:", Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.46, Graphics.FONT_NUMBER_HOT, distance.toString(), Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.68, Graphics.FONT_XTINY, "cm", Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.78, Graphics.FONT_XTINY, "UP: +10  DOWN: -10", Graphics.TEXT_JUSTIFY_CENTER);
            dc.drawText(cx, h * 0.86, Graphics.FONT_XTINY, "SELECT: confirm", Graphics.TEXT_JUSTIFY_CENTER);
        }
    }
}
