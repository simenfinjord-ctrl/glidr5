// MainMenuDelegate.mc — handles input for main menu

using Toybox.WatchUi;
using Toybox.Application.Storage;

class MainMenuDelegate extends WatchUi.BehaviorDelegate {
    var view;

    function initialize(v) {
        BehaviorDelegate.initialize();
        view = v;
    }

    function onNextPage() {
        // DOWN
        var count = view.menuItems.size();
        view.selectedIndex = (view.selectedIndex + 1) % count;
        WatchUi.requestUpdate();
        return true;
    }

    function onPreviousPage() {
        // UP
        var count = view.menuItems.size();
        view.selectedIndex = (view.selectedIndex + count - 1) % count;
        WatchUi.requestUpdate();
        return true;
    }

    function onSelect() {
        var pin = view.teamPin;
        switch (view.selectedIndex) {
            case 0:
                // From List
                var listView = new QueueListView(pin);
                var listDelegate = new QueueListDelegate(listView);
                WatchUi.switchToView(listView, listDelegate, WatchUi.SLIDE_LEFT);
                break;
            case 1:
                // From Code
                var codeView = new CodeEntryView();
                var codeDelegate = new CodeEntryDelegate(codeView);
                WatchUi.switchToView(codeView, codeDelegate, WatchUi.SLIDE_LEFT);
                break;
            case 2:
                // Archive
                var archView = new ArchiveView(pin);
                var archDelegate = new ArchiveDelegate(archView);
                WatchUi.switchToView(archView, archDelegate, WatchUi.SLIDE_LEFT);
                break;
            case 3:
                // Settings — clear PIN and go to setup
                Storage.deleteValue("teamPin");
                Storage.deleteValue("teamName");
                var setupView = new PinSetupView();
                var setupDelegate = new PinSetupDelegate(setupView);
                WatchUi.switchToView(setupView, setupDelegate, WatchUi.SLIDE_LEFT);
                break;
        }
        return true;
    }

    function onBack() {
        // Back from main menu exits app
        return false;
    }
}
