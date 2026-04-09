using Toybox.WatchUi;
using Toybox.Graphics;

class AutoConnectView extends WatchUi.View {
    var garminId as String;
    var statusText as String = "Connecting...";
    var isConnecting as Boolean = true;
    var sessionCode as String = "";

    function initialize(gId as String) {
        View.initialize();
        garminId = gId;
    }

    function onUpdate(dc as Dc) as Void {
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.15, Graphics.FONT_SMALL, "GLIDR", Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.35, Graphics.FONT_XTINY, statusText, Graphics.TEXT_JUSTIFY_CENTER);

        if (!sessionCode.equals("")) {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.50, Graphics.FONT_XTINY, "Session: " + sessionCode, Graphics.TEXT_JUSTIFY_CENTER);
        }

        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.72, Graphics.FONT_XTINY, "Auto-connect via", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, h * 0.80, Graphics.FONT_XTINY, "Garmin account", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, h * 0.88, Graphics.FONT_XTINY, "BACK: manual code", Graphics.TEXT_JUSTIFY_CENTER);
    }
}
