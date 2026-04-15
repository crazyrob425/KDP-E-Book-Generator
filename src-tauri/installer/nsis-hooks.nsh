!macro NSIS_HOOK_PREINSTALL
  MessageBox MB_ICONEXCLAMATION|MB_YESNO "Before continuing, you must accept the EULA and Terms shown in this installer. Continue?" IDYES +2
  Abort
!macroend
