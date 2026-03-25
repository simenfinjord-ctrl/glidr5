{pkgs}: {
  deps = [
    pkgs.gtk3
    pkgs.xorg.libxcb
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.mesa
    pkgs.alsa-lib
    pkgs.cairo
    pkgs.pango
    pkgs.libxkbcommon
    pkgs.libdrm
    pkgs.expat
    pkgs.dbus
    pkgs.cups
    pkgs.at-spi2-atk
    pkgs.nspr
    pkgs.nss
    pkgs.glib
  ];
}
