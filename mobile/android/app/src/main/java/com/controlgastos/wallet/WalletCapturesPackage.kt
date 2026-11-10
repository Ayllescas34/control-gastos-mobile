package com.controlgastos.wallet

import com.facebook.fbreact.specs.NativeWalletCapturesSpec
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Registers WalletCapturesModule as a Turbo Native Module (added in MainApplication). */
class WalletCapturesPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == NativeWalletCapturesSpec.NAME) WalletCapturesModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
        NativeWalletCapturesSpec.NAME to
            ReactModuleInfo(
                name = NativeWalletCapturesSpec.NAME,
                className = NativeWalletCapturesSpec.NAME,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = true,
            )
    )
  }
}
