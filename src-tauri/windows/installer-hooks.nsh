; A versioned icon path invalidates Windows Search's cached empty shortcut icon.
!macro NSIS_HOOK_POSTINSTALL
  ; Packaged launchers can redirect AppData; shell shortcuts need the physical path.
  Push $0
  Push $1
  Push $2
  System::Call 'kernel32::CreateFileW(w "$INSTDIR\${MAINBINARYNAME}.exe", i 0, i 7, p 0, i 3, i 0, p 0) p .r0'
  ${If} $0 != -1
    System::Call 'kernel32::GetFinalPathNameByHandleW(p r0, w .r1, i ${NSIS_MAX_STRLEN}, i 0) i .r2'
    System::Call 'kernel32::CloseHandle(p r0)'
    ${If} $2 > 0
    ${AndIf} $2 < ${NSIS_MAX_STRLEN}
      StrCpy $2 $1 8
      ${If} $2 == "\\?\UNC\"
        StrCpy $1 $1 "" 8
        StrCpy $1 "\\$1"
      ${Else}
        StrCpy $1 $1 "" 4
      ${EndIf}
      ${GetParent} "$1" $INSTDIR
      WriteRegStr SHCTX "${MANUPRODUCTKEY}" "" "$INSTDIR"
      WriteRegStr SHCTX "${UNINSTKEY}" "DisplayIcon" '$\"$INSTDIR\${MAINBINARYNAME}.exe$\"'
      WriteRegStr SHCTX "${UNINSTKEY}" "InstallLocation" '$\"$INSTDIR$\"'
      WriteRegStr SHCTX "${UNINSTKEY}" "UninstallString" '$\"$INSTDIR\uninstall.exe$\"'
    ${EndIf}
  ${EndIf}
  Pop $2
  Pop $1
  Pop $0
  ${If} ${FileExists} "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    CreateShortCut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\Lumaire-${VERSION}.ico" 0
    !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"
  ${EndIf}
  ${If} ${FileExists} "$DESKTOP\${PRODUCTNAME}.lnk"
    CreateShortCut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\Lumaire-${VERSION}.ico" 0
    !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
  ${EndIf}
  System::Call 'shell32::SHChangeNotify(i 0x00002000, i 0x0005, w "$SMPROGRAMS\${PRODUCTNAME}.lnk", p 0)'
!macroend
