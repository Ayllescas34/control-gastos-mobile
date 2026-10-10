package com.controlgastos.backup

import com.facebook.fbreact.specs.NativeBackupFilesSpec
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Registers BackupFilesModule as a Turbo Native Module (added in MainApplication). */
class BackupFilesPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == NativeBackupFilesSpec.NAME) BackupFilesModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
        NativeBackupFilesSpec.NAME to
            ReactModuleInfo(
                name = NativeBackupFilesSpec.NAME,
                className = NativeBackupFilesSpec.NAME,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = true,
            )
    )
  }
}
