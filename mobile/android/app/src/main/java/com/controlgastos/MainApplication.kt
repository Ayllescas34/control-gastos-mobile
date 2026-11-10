package com.controlgastos

import android.app.Application
import com.controlgastos.backup.BackupFilesPackage
import com.controlgastos.security.AppLockPackage
import com.controlgastos.wallet.WalletCapturesPackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          // Backup files through the Storage Access Framework (docs/backup.md).
          add(BackupFilesPackage())
          // Google Wallet payment notifications (docs/google-wallet.md).
          add(WalletCapturesPackage())
          // App PIN lock (docs/security.md).
          add(AppLockPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
