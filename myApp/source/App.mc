using Toybox.Application;
using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.Communications;
using Toybox.System;

// ─── Server config ───────────────────────────────────────────────
module ServerConfig {
    var BASE_URL = "https://ac3d4767-0a07-4b58-94b0-7a7a7b74bd4d-00-3p0w3ghd4ubnp.riker.replit.dev";
}

// ─── App entry point ─────────────────────────────────────────────
class GlidrApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function onStart(state) {
    }

    function onStop(state) {
    }

    function getInitialView() {
        var view = new CodeEntryView();
        var delegate = new CodeEntryDelegate(view);
        return [view, delegate];
    }
}

// ─── Code entry screen (6-digit session code) ───────────────────
class CodeEntryView extends WatchUi.View {
    var digits = [0, 0, 0, 0, 0, 0];
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
        dc.drawText(cx, h * 15 / 100, Graphics.FONT_SMALL, "GLIDR", Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 28 / 100, Graphics.FONT_XTINY, statusText, Graphics.TEXT_JUSTIFY_CENTER);

        var digitWidth = 28;
        var totalWidth = digitWidth * 6 + 10;
        var startX = cx - totalWidth / 2;
        var digitY = h * 45 / 100;

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
        dc.drawText(cx, h * 72 / 100, Graphics.FONT_XTINY, "UP/DN: change digit", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, h * 80 / 100, Graphics.FONT_XTINY, "SELECT: next / connect", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, h * 88 / 100, Graphics.FONT_XTINY, "BACK: prev digit", Graphics.TEXT_JUSTIFY_CENTER);
    }

    function getCode() {
        var code = "";
        for (var i = 0; i < 6; i++) {
            code += digits[i].toString();
        }
        return code;
    }
}

// ─── Code entry input delegate ──────────────────────────────────
class CodeEntryDelegate extends WatchUi.BehaviorDelegate {
    var view;

    function initialize(v) {
        BehaviorDelegate.initialize();
        view = v;
    }

    function onNextPage() {
        view.digits[view.cursorPos] = (view.digits[view.cursorPos] + 1) % 10;
        WatchUi.requestUpdate();
        return true;
    }

    function onPreviousPage() {
        view.digits[view.cursorPos] = (view.digits[view.cursorPos] + 9) % 10;
        WatchUi.requestUpdate();
        return true;
    }

    function onSelect() {
        if (view.cursorPos < 5) {
            view.cursorPos++;
            WatchUi.requestUpdate();
        } else {
            connectToSession();
        }
        return true;
    }

    function onBack() {
        if (view.cursorPos > 0) {
            view.cursorPos--;
            WatchUi.requestUpdate();
            return true;
        }
        return false;
    }

    function connectToSession() {
        view.isConnecting = true;
        view.statusText = "Connecting...";
        WatchUi.requestUpdate();

        var code = view.getCode();
        var url = ServerConfig.BASE_URL + "/api/runsheet/watch/" + code;

        Communications.makeWebRequest(
            url,
            null,
            {
                :method => Communications.HTTP_REQUEST_METHOD_GET,
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
            },
            method(:onConnectResponse)
        );
    }

    function onConnectResponse(responseCode, data) {
        view.isConnecting = false;

        if (responseCode == 200 && data != null && data instanceof Toybox.Lang.Dictionary) {
            var code = view.getCode();
            var heatView = new HeatView(code);

            if (data["currentHeat"] != null && data["currentHeat"] instanceof Toybox.Lang.Dictionary) {
                var ch = data["currentHeat"];
                heatView.roundName = ch["roundName"];
                heatView.pairA = ch["pairA"];
                heatView.pairB = ch["pairB"];
                heatView.roundIndex = ch["roundIndex"];
                heatView.heatIndex = ch["heatIndex"];
                heatView.statusText = "Select winner";
            } else if (data["complete"] == true) {
                heatView.statusText = "All heats complete!";
                heatView.allDone = true;
            } else {
                heatView.statusText = "Waiting for heats...";
            }

            var heatDelegate = new HeatDelegate(heatView);
            WatchUi.switchToView(heatView, heatDelegate, WatchUi.SLIDE_LEFT);
        } else {
            view.statusText = "Invalid code!";
            view.cursorPos = 0;
            WatchUi.requestUpdate();
        }
    }
}

// ─── Heat view (shows current matchup / distance entry) ─────────
class HeatView extends WatchUi.View {
    var sessionCode = "";
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
            dc.drawText(cx, h * 35 / 100, Graphics.FONT_MEDIUM, "DONE!", Graphics.TEXT_JUSTIFY_CENTER);
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 55 / 100, Graphics.FONT_SMALL, "All heats complete", Graphics.TEXT_JUSTIFY_CENTER);
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 70 / 100, Graphics.FONT_XTINY, "BACK to exit", Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        if (isSending) {
            dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 45 / 100, Graphics.FONT_SMALL, "Sending...", Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 8 / 100, Graphics.FONT_XTINY, roundName, Graphics.TEXT_JUSTIFY_CENTER);

        if (phase == 0) {
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 20 / 100, Graphics.FONT_SMALL, "Select winner", Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 38 / 100, Graphics.FONT_MEDIUM, "Par " + pairA.toString(), Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 53 / 100, Graphics.FONT_SMALL, "vs", Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 65 / 100, Graphics.FONT_MEDIUM, "Par " + pairB.toString(), Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 82 / 100, Graphics.FONT_XTINY, "UP = Par " + pairA.toString(), Graphics.TEXT_JUSTIFY_CENTER);
            dc.drawText(cx, h * 90 / 100, Graphics.FONT_XTINY, "DOWN = Par " + pairB.toString(), Graphics.TEXT_JUSTIFY_CENTER);

        } else if (phase == 1) {
            var loserPair = (selectedWinner == pairA) ? pairB : pairA;

            dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 18 / 100, Graphics.FONT_SMALL, "Par " + selectedWinner.toString() + " wins", Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 33 / 100, Graphics.FONT_SMALL, "Par " + loserPair.toString() + " behind:", Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 50 / 100, Graphics.FONT_NUMBER_HOT, distance.toString(), Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 72 / 100, Graphics.FONT_XTINY, "cm", Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 82 / 100, Graphics.FONT_XTINY, "UP/DN: +/- 10 cm", Graphics.TEXT_JUSTIFY_CENTER);
            dc.drawText(cx, h * 90 / 100, Graphics.FONT_XTINY, "SELECT: confirm", Graphics.TEXT_JUSTIFY_CENTER);
        }
    }
}

// ─── Heat input delegate ────────────────────────────────────────
class HeatDelegate extends WatchUi.BehaviorDelegate {
    var view;

    function initialize(v) {
        BehaviorDelegate.initialize();
        view = v;
    }

    function onNextPage() {
        if (view.allDone || view.isSending) { return true; }

        if (view.phase == 0) {
            view.selectedWinner = view.pairA;
            view.phase = 1;
            view.distance = 10;
            WatchUi.requestUpdate();
        } else if (view.phase == 1) {
            view.distance += 10;
            if (view.distance > 990) { view.distance = 990; }
            WatchUi.requestUpdate();
        }
        return true;
    }

    function onPreviousPage() {
        if (view.allDone || view.isSending) { return true; }

        if (view.phase == 0) {
            view.selectedWinner = view.pairB;
            view.phase = 1;
            view.distance = 10;
            WatchUi.requestUpdate();
        } else if (view.phase == 1) {
            view.distance -= 10;
            if (view.distance < 10) { view.distance = 10; }
            WatchUi.requestUpdate();
        }
        return true;
    }

    function onSelect() {
        if (view.allDone || view.isSending) { return true; }

        if (view.phase == 1) {
            submitResult();
        }
        return true;
    }

    function onBack() {
        if (view.phase == 1) {
            view.phase = 0;
            view.distance = 0;
            WatchUi.requestUpdate();
            return true;
        }
        return false;
    }

    function submitResult() {
        view.isSending = true;
        WatchUi.requestUpdate();

        var url = ServerConfig.BASE_URL + "/api/runsheet/watch/" + view.sessionCode + "/result";

        var body = {
            "roundIndex" => view.roundIndex,
            "heatIndex" => view.heatIndex,
            "winnerPair" => view.selectedWinner,
            "loserDistance" => view.distance
        };

        Communications.makeWebRequest(
            url,
            body,
            {
                :method => Communications.HTTP_REQUEST_METHOD_POST,
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
                :headers => {
                    "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON
                }
            },
            method(:onSubmitResponse)
        );
    }

    function onSubmitResponse(responseCode, data) {
        view.isSending = false;

        if (responseCode == 200 && data != null && data instanceof Toybox.Lang.Dictionary) {
            if (data["nextHeat"] != null && data["nextHeat"] instanceof Toybox.Lang.Dictionary) {
                var nh = data["nextHeat"];
                view.roundName = nh["roundName"];
                view.pairA = nh["pairA"];
                view.pairB = nh["pairB"];
                view.roundIndex = nh["roundIndex"];
                view.heatIndex = nh["heatIndex"];
                view.statusText = "Select winner";
                view.phase = 0;
                view.distance = 0;
            } else {
                view.allDone = true;
            }
        } else {
            view.statusText = "Error! Try again";
            view.phase = 0;
        }

        WatchUi.requestUpdate();
    }
}
