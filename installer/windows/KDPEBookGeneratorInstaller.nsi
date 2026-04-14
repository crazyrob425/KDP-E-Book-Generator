; KDPEBookGeneratorInstaller.nsi
; Prep-only custom Windows installer wizard (do not compile until directed).

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"
!include "x64.nsh"

Unicode True
RequestExecutionLevel admin

!define APP_NAME "KDP E-Book Generator"
!define COMPANY_NAME "Blacklisted Binary Labs"
!define PRODUCT_VERSION "2.1.0"
!define INSTALLER_NAME "KDP-E-Book-Generator-Setup.exe"
!define MAIN_EXE "KDP E-Book Generator.exe"
!define REG_PATH "Software\\${COMPANY_NAME}\\${APP_NAME}"

Name "${APP_NAME}"
OutFile "${INSTALLER_NAME}"
InstallDir "$PROGRAMFILES64\\${COMPANY_NAME}\\${APP_NAME}"
InstallDirRegKey HKLM "${REG_PATH}" "InstallDir"
BrandingText "${COMPANY_NAME}"
ShowInstDetails show
ShowUninstDetails show

!define MUI_ABORTWARNING
!define MUI_ICON "assets\\installer-icon.ico"
!define MUI_UNICON "assets\\installer-icon.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "assets\\wizard-header.png"
!define MUI_WELCOMEFINISHPAGE_BITMAP "assets\\installer-splash.png"

Var UserName
Var UserEmail
Var NameInput
Var EmailInput
Var StatusLabel
Var LinkGithub
Var LinkWebsite
Var ContactInfoText
Var ContactOptInCheckbox

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "legal\\EULA_MAIN_TOS.txt"
!insertmacro MUI_PAGE_LICENSE "legal\\BETA_HOLD_HARMLESS_ADDENDUM.txt"
!insertmacro MUI_PAGE_LICENSE "legal\\THIRD_PARTY_AND_AI_USE_NOTICE.txt"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
Page custom ResourceCheckPageCreate ResourceCheckPageLeave
!insertmacro MUI_PAGE_INSTFILES
Page custom FinalContactPageCreate FinalContactPageLeave

!insertmacro MUI_LANGUAGE "English"

Section "Core Application Files" SEC_CORE
  SetShellVarContext all
  SetOutPath "$INSTDIR"

  ; Ship the compiled desktop app payload.
  ; Paths are relative to installer/windows at compile time.
  File "..\\..\\src-tauri\\target\\release\\${MAIN_EXE}"
  File /r "..\\..\\src-tauri\\target\\release\\deps\\*.*"

  ; Ship the app icon so shortcuts use the same custom branding even if the
  ; executable icon is updated later.
  SetOutPath "$INSTDIR\\installer-support"
  File "..\\..\\src-tauri\\icons\\icon.ico"

  ; Persist install location.
  WriteRegStr HKLM "${REG_PATH}" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "${REG_PATH}" "Version" "${PRODUCT_VERSION}"

  ; Uninstall registration.
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_NAME}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_NAME}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_NAME}" "Publisher" "${COMPANY_NAME}"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_NAME}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_NAME}" "UninstallString" '"$INSTDIR\\Uninstall.exe"'
  WriteUninstaller "$INSTDIR\\Uninstall.exe"
SectionEnd

Section "Create Desktop Shortcut" SEC_DESKTOP
  SetShellVarContext all
  CreateShortcut "$DESKTOP\\${APP_NAME}.lnk" "$INSTDIR\\${MAIN_EXE}" "" "$INSTDIR\\installer-support\\icon.ico" 0
SectionEnd

Section "Create Start Menu Shortcut" SEC_STARTMENU
  SetShellVarContext all
  CreateDirectory "$SMPROGRAMS\\${COMPANY_NAME}"
  CreateShortcut "$SMPROGRAMS\\${COMPANY_NAME}\\${APP_NAME}.lnk" "$INSTDIR\\${MAIN_EXE}" "" "$INSTDIR\\installer-support\\icon.ico" 0
  CreateShortcut "$SMPROGRAMS\\${COMPANY_NAME}\\Uninstall ${APP_NAME}.lnk" "$INSTDIR\\Uninstall.exe"
SectionEnd

Section "Install/repair runtime prerequisites (simulation prep)" SEC_PREREQ
  SetOutPath "$INSTDIR\\installer-support"
  File "scripts\\preinstall-check-and-bootstrap.ps1"
  nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -NoProfile -File "$INSTDIR\\installer-support\\preinstall-check-and-bootstrap.ps1" -Silent'
SectionEnd

Section "Uninstall"
  SetShellVarContext all
  Delete "$INSTDIR\\installer-support\\icon.ico"
  Delete "$INSTDIR\\Uninstall.exe"
  Delete "$DESKTOP\\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\\${COMPANY_NAME}\\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\\${COMPANY_NAME}\\Uninstall ${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\\${COMPANY_NAME}"
  RMDir /r "$INSTDIR\\installer-support"
  RMDir /r "$INSTDIR"

  DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_NAME}"
  DeleteRegKey HKLM "${REG_PATH}"
  DeleteRegValue HKCU "${REG_PATH}" "ContactOptIn"
SectionEnd

Function ResourceCheckPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "System Compatibility Scan"
  Pop $1
  ${NSD_CreateLabel} 0 26u 100% 40u "The installer will now run a compatibility simulation for CPU/RAM/Disk/GPU readiness. In this prep profile, checks are informational and expected to pass."
  Pop $2

  ${NSD_CreateLabel} 0 78u 100% 24u "Preparing installation pipeline in parallel…"
  Pop $StatusLabel

  nsDialogs::Show
FunctionEnd

Function ResourceCheckPageLeave
  DetailPrint "[Installer] Running simulated resource checks."
  Sleep 500
  DetailPrint "[Check] CPU capability ........ PASS"
  Sleep 350
  DetailPrint "[Check] RAM availability ...... PASS"
  Sleep 350
  DetailPrint "[Check] Disk availability ..... PASS"
  Sleep 350
  DetailPrint "[Check] GPU capability ........ PASS"
  Sleep 350
  DetailPrint "[Check] OS compatibility ...... PASS"
  Sleep 350
  DetailPrint "[Installer] Compatibility simulation complete."
FunctionEnd

Function FinalContactPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 20u "Installation Complete"
  Pop $1

  ${NSD_CreateLabel} 0 24u 100% 18u "Optional: Enter your details for update/release news"
  Pop $2

  ${NSD_CreateLabel} 0 48u 35% 12u "Name"
  Pop $3
  ${NSD_CreateText} 0 62u 100% 12u ""
  Pop $NameInput

  ${NSD_CreateLabel} 0 82u 35% 12u "Email"
  Pop $4
  ${NSD_CreateText} 0 96u 100% 12u ""
  Pop $EmailInput

  ${NSD_CreateCheckbox} 0 112u 100% 14u "I consent to storing this optional contact info for update/release notifications on this device."
  Pop $ContactOptInCheckbox

  ${NSD_CreateLabel} 0 132u 100% 30u "Developer Team: Blacklisted Binary Labs$\r$\nLead Developer: Rob Branting (BBLabs Founding Member)"
  Pop $5

  ${NSD_CreateLink} 0 168u 100% 12u "Official GitHub: https://github.com/Blacklisted-Binary"
  Pop $LinkGithub
  ${NSD_OnClick} $LinkGithub OpenGithub

  ${NSD_CreateLink} 0 184u 100% 12u "Official Website: https://www.blacklistedbinary.com"
  Pop $LinkWebsite
  ${NSD_OnClick} $LinkWebsite OpenWebsite

  nsDialogs::Show
FunctionEnd

Function FinalContactPageLeave
  ${NSD_GetText} $NameInput $UserName
  ${NSD_GetText} $EmailInput $UserEmail
  ${NSD_GetState} $ContactOptInCheckbox $0

  StrCpy $ContactInfoText ""
  ${If} $0 == ${BST_CHECKED}
    ${If} "$UserName$UserEmail" != ""
      StrCpy $ContactInfoText "Name=$UserName | Email=$UserEmail"
      WriteRegStr HKCU "${REG_PATH}" "ContactOptIn" "$ContactInfoText"
      DetailPrint "[Installer] Optional contact captured: $ContactInfoText"
    ${Else}
      DetailPrint "[Installer] Contact opt-in selected, but no contact details provided. Nothing persisted."
    ${EndIf}
  ${Else}
    DetailPrint "[Installer] Contact opt-in not selected. No contact details stored."
  ${EndIf}
  DetailPrint "[Installer] For update automation, use scripts\\check-latest-release.ps1 to query latest GitHub release metadata."
FunctionEnd

Function OpenGithub
  ExecShell "open" "https://github.com/Blacklisted-Binary"
FunctionEnd

Function OpenWebsite
  ExecShell "open" "https://www.blacklistedbinary.com"
FunctionEnd
