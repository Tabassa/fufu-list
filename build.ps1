$ErrorActionPreference = 'Stop'
$taskProject = $PSScriptRoot
$taskTools = Join-Path (Split-Path $taskProject) 'toolchain'
$taskSdk = Join-Path $taskTools 'sdk'
$taskJava = Join-Path $taskTools 'jdk'
$taskBuildTools = Join-Path $taskSdk 'build-tools\35.0.0'
$taskAndroidJar = Join-Path $taskSdk 'platforms\android-35\android.jar'
$taskBuild = Join-Path $taskProject 'build'
$taskKeys = Join-Path (Split-Path $taskProject) 'fufu-signing'
$env:JAVA_HOME = $taskJava
New-Item -ItemType Directory -Force -Path $taskBuild,(Join-Path $taskBuild 'generated'),(Join-Path $taskBuild 'classes'),(Join-Path $taskBuild 'dex'),$taskKeys | Out-Null

function Run-Checked([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program exited with $LASTEXITCODE" }
}

Run-Checked (Join-Path $taskBuildTools 'aapt2.exe') @('compile','--dir',(Join-Path $taskProject 'res'),'-o',(Join-Path $taskBuild 'resources.zip'))
Run-Checked (Join-Path $taskBuildTools 'aapt2.exe') @('link','-o',(Join-Path $taskBuild 'unsigned.apk'),'-I',$taskAndroidJar,'--manifest',(Join-Path $taskProject 'AndroidManifest.xml'),'--java',(Join-Path $taskBuild 'generated'),'-A',(Join-Path $taskProject 'assets'),(Join-Path $taskBuild 'resources.zip'),'--version-code','2','--version-name','1.0.1')
$taskSources = @(Get-ChildItem -LiteralPath (Join-Path $taskProject 'src'),(Join-Path $taskBuild 'generated') -Recurse -Filter '*.java' | ForEach-Object { $_.FullName })
Run-Checked (Join-Path $taskJava 'bin\javac.exe') (@('-J-Duser.language=en','-encoding','UTF-8','--release','8','-classpath',$taskAndroidJar,'-d',(Join-Path $taskBuild 'classes')) + $taskSources)
$taskClasses = @(Get-ChildItem -LiteralPath (Join-Path $taskBuild 'classes') -Recurse -Filter '*.class' | ForEach-Object { $_.FullName })
Run-Checked (Join-Path $taskBuildTools 'd8.bat') (@('--lib',$taskAndroidJar,'--min-api','23','--output',(Join-Path $taskBuild 'dex')) + $taskClasses)
Run-Checked (Join-Path $taskJava 'bin\jar.exe') @('uf',(Join-Path $taskBuild 'unsigned.apk'),'-C',(Join-Path $taskBuild 'dex'),'classes.dex')
Run-Checked (Join-Path $taskBuildTools 'zipalign.exe') @('-f','-p','4',(Join-Path $taskBuild 'unsigned.apk'),(Join-Path $taskBuild 'aligned.apk'))
$taskKeyFile = Join-Path $taskKeys 'release.jks'
$taskPasswordFile = Join-Path $taskKeys 'password.txt'
if (!(Test-Path -LiteralPath $taskKeyFile)) {
    [IO.File]::WriteAllText($taskPasswordFile,[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(24)))
    Run-Checked (Join-Path $taskJava 'bin\keytool.exe') @('-genkeypair','-keystore',$taskKeyFile,'-storepass:file',$taskPasswordFile,'-keypass:file',$taskPasswordFile,'-alias','fufu','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Fufu List, OU=Personal App')
}
Run-Checked (Join-Path $taskBuildTools 'apksigner.bat') @('sign','--ks',$taskKeyFile,'--ks-pass',('file:' + $taskPasswordFile),'--out',(Join-Path $taskBuild 'fufu-list-1.0.1.apk'),(Join-Path $taskBuild 'aligned.apk'))
Run-Checked (Join-Path $taskBuildTools 'apksigner.bat') @('verify','--verbose','--print-certs',(Join-Path $taskBuild 'fufu-list-1.0.1.apk'))
Get-Item -LiteralPath (Join-Path $taskBuild 'fufu-list-1.0.1.apk') | Select-Object FullName,Length
