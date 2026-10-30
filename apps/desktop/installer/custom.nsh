; A per-user beta needs no administrator selection page.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "MMPlayer Beta"
  !insertmacro MUI_PAGE_WELCOME
!macroend
