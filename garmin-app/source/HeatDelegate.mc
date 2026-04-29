using Toybox.WatchUi;
using Toybox.Communications;

class HeatDelegate extends WatchUi.BehaviorDelegate {
    var view;

    function initialize(v) {
        BehaviorDelegate.initialize();
        view = v;
    }

    function onNextPage() {
        // DOWN button
        if (view.allDone || view.isSending) { return true; }

        if (view.phase == 0) {
            view.selectedWinner = view.pairB;
            view.selectedLabel = view.labelB;
            view.loserLabel = view.labelA;
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

    function onPreviousPage() {
        // UP button
        if (view.allDone || view.isSending) { return true; }

        if (view.phase == 0) {
            view.selectedWinner = view.pairA;
            view.selectedLabel = view.labelA;
            view.loserLabel = view.labelB;
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

    function onSelect() {
        if (view.isSending || view.isApplying) { return true; }

        if (view.allDone && !view.applied) {
            applyResults();
            return true;
        }

        if (view.phase == 1) {
            submitResult();
        }
        return true;
    }

    function applyResults() {
        view.isApplying = true;
        WatchUi.requestUpdate();

        var url = ServerConfig.BASE_URL + "/api/runsheet/sessions/" + view.sessionCode + "/apply";

        Communications.makeWebRequest(
            url,
            {},
            {
                :method => Communications.HTTP_REQUEST_METHOD_POST,
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
                :headers => { "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON }
            },
            method(:onApplyResponse)
        );
    }

    function onApplyResponse(responseCode, data) {
        view.isApplying = false;
        if (responseCode == 200) {
            view.applied = true;
        } else {
            view.statusText = "Apply failed!";
        }
        WatchUi.requestUpdate();
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

        if (responseCode == 200 && data != null && data instanceof Dictionary) {
            if (data["nextHeat"] != null && data["nextHeat"] instanceof Dictionary) {
                var nh = data["nextHeat"];
                view.roundName = nh["roundName"];
                view.pairA = nh["pairA"];
                view.pairB = nh["pairB"];
                view.labelA = nh["labelA"] != null ? nh["labelA"] : nh["pairA"].toString();
                view.labelB = nh["labelB"] != null ? nh["labelB"] : nh["pairB"].toString();
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
