#define AppName "ALAXEE SteamHub"
#define AppVersion "0.1.0"
#define AppPublisher "ALAXEE"

[Setup]
AppId={{A4C5DAD5-0D5A-4C96-8EF6-7D23C776A3D1}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\ALAXEE\SteamHub
DefaultGroupName=ALAXEE SteamHub
UninstallDisplayName=ALAXEE SteamHub
UninstallDisplayIcon={app}\AlaxeeSteamBridge.exe
PrivilegesRequired=lowest
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
DisableProgramGroupPage=yes
UsePreviousAppDir=yes
Uninstallable=yes
CloseApplications=yes
CloseApplicationsFilter=AlaxeeSteamBridge.exe
RestartApplications=no
OutputDir=..\dist
OutputBaseFilename=ALAXEE-SteamHub-Setup-x64
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
VersionInfoCompany=ALAXEE
VersionInfoProductName=ALAXEE SteamHub
VersionInfoProductVersion=0.1.0.0
VersionInfoDescription=ALAXEE SteamHub installer

[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[CustomMessages]
chinesesimp.RemoveLocalDataPrompt=是否同时删除此设备上的 ALAXEE SteamHub 设置、缓存、日志和临时文件？%n%n选择“是”会彻底清理本地数据；选择“否”会保留本地数据，方便以后重新安装。%n%nSupabase 云端账号和跨设备同步数据不会被删除。
chinesesimp.DesktopIcon=创建桌面快捷方式
chinesesimp.AdditionalIcons=附加快捷方式：

[Tasks]
Name: "desktopicon"; Description: "{cm:DesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Dirs]
Name: "{localappdata}\ALAXEE\SteamHub"; Flags: uninsneveruninstall

[Files]
Source: "..\dist\_windows-package\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\ALAXEE SteamHub"; Filename: "{app}\Start-Steam-Bridge.bat"; WorkingDir: "{app}"; IconFilename: "{app}\AlaxeeSteamBridge.exe"
Name: "{autodesktop}\ALAXEE SteamHub"; Filename: "{app}\Start-Steam-Bridge.bat"; WorkingDir: "{app}"; IconFilename: "{app}\AlaxeeSteamBridge.exe"; Tasks: desktopicon

[Code]
var
  RemoveLocalDataOnUninstall: Boolean;

function UninstallParameterExists(const Value: String): Boolean;
var
  Index: Integer;
begin
  Result := False;
  for Index := 1 to ParamCount do
  begin
    if CompareText(ParamStr(Index), Value) = 0 then
    begin
      Result := True;
      Exit;
    end;
  end;
end;

function InitializeUninstall(): Boolean;
var
  ResultCode: Integer;
  LaunchSucceeded: Boolean;
  StopScript: String;
  StopScriptLog: String;
  PowerShellExecutable: String;
  StopParameters: String;
  LocalDataPath: String;
begin
  Result := True;
  StopScript := ExpandConstant('{app}\scripts\Stop-AlaxeeSteamBridge.ps1');
  PowerShellExecutable := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
  StopScriptLog := ExpandConstant('{localappdata}\Temp\ALAXEE-SteamHub-stop-') +
    GetDateTimeString('yyyymmddhhnnss', '/', ':') + '.log';

  Log('ALAXEE SteamHub uninstall preflight started.');
  Log('Stop script path: ' + StopScript);
  Log('PowerShell path: ' + PowerShellExecutable);
  Log('Stop script log path: ' + StopScriptLog);

  if not FileExists(StopScript) then
  begin
    Log('Uninstall aborted: stop script is missing.');
    MsgBox('ALAXEE SteamHub stop script is missing. Uninstall has been cancelled to protect running files.',
      mbError, MB_OK);
    Result := False;
    Exit;
  end;

  if not FileExists(PowerShellExecutable) then
  begin
    Log('Uninstall aborted: Windows PowerShell 5.1 executable is missing.');
    MsgBox('Windows PowerShell 5.1 could not be found. Uninstall has been cancelled.',
      mbError, MB_OK);
    Result := False;
    Exit;
  end;

  StopParameters := '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' +
    StopScript + '" -ExpectedExecutable "' +
    ExpandConstant('{app}\AlaxeeSteamBridge.exe') + '" -LogPath "' +
    StopScriptLog + '"';

  Log('Launching the ALAXEE SteamHub process-stop script.');
  LaunchSucceeded := Exec(PowerShellExecutable, StopParameters,
    ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ResultCode);

  if not LaunchSucceeded then
  begin
    Log('PowerShell launch failed. Windows error code: ' + IntToStr(ResultCode));
    MsgBox('Could not start the SteamHub stop script (Windows error ' +
      IntToStr(ResultCode) + '). Uninstall has been cancelled.',
      mbError, MB_OK);
    Result := False;
    Exit;
  end;

  Log('PowerShell stop script exited with code ' + IntToStr(ResultCode) + '.');
  if ResultCode <> 0 then
  begin
    Log('Uninstall aborted because the SteamHub bridge did not stop successfully. Log: ' + StopScriptLog);
    MsgBox('ALAXEE SteamHub could not stop safely. Uninstall has been cancelled.' + #13#10 +
      'Diagnostic log: ' + StopScriptLog,
      mbError, MB_OK);
    Result := False;
    Exit;
  end;

  if not FileExists(StopScriptLog) then
  begin
    Log('Uninstall aborted: stop script returned success without creating its diagnostic log.');
    MsgBox('The SteamHub stop script did not produce its diagnostic log. Uninstall has been cancelled.',
      mbError, MB_OK);
    Result := False;
    Exit;
  end;

  Log('ALAXEE SteamHub process-stop script completed successfully.');
  if UninstallParameterExists('/KEEPLOCALDATA') then
    RemoveLocalDataOnUninstall := False
  else if UninstallSilent then
    RemoveLocalDataOnUninstall := True
  else
    RemoveLocalDataOnUninstall :=
      MsgBox(ExpandConstant('{cm:RemoveLocalDataPrompt}'),
        mbConfirmation, MB_YESNO or MB_DEFBUTTON1) = IDYES;

  if RemoveLocalDataOnUninstall then
  begin
    LocalDataPath := ExpandConstant('{localappdata}\ALAXEE\SteamHub');
    if DirExists(LocalDataPath) then
    begin
      if not DelTree(LocalDataPath, True, True, True) then
      begin
        MsgBox('Could not remove all local ALAXEE SteamHub data. The uninstall has been cancelled so no partial cleanup is hidden.',
          mbError, MB_OK);
        Result := False;
        Exit;
      end;
    end;
    RemoveDir(ExtractFileDir(LocalDataPath));
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  AppParentPath: String;
  DataParentPath: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    AppParentPath := ExtractFileDir(ExpandConstant('{app}'));
    DataParentPath := ExpandConstant('{localappdata}\ALAXEE');
    RemoveDir(AppParentPath);
    RemoveDir(DataParentPath);
  end;
end;
