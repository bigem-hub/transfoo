package com.transfo;
import com.facebook.react.ReactApplication;
import android.app.Application;
import android.content.Context;
import com.facebook.react.PackageList;
import com.facebook.react.ReactPackage;
import com.facebook.react.ReactNativeHost;
import java.util.List;
public class MainApplication extends Application implements ReactApplication {
  private final ReactNativeHost host = new ReactNativeHost(this) {
    @Override public boolean getUseDeveloperSupport() { return true; }
    @Override protected List<ReactPackage> getPackages() { return new PackageList(this).getPackages(); }
    @Override protected String getJSMainModuleName() { return "index"; }
  };
  @Override public ReactNativeHost getReactNativeHost() { return host; }
}
