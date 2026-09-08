#import <React/RCTBridgeModule.h>

// Expose le module Swift `RelockAppIcon` (icônes alternatives) au bridge
// React Native.
@interface RCT_EXTERN_MODULE (RelockAppIcon, NSObject)

RCT_EXTERN_METHOD(isSupported
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(current
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setIcon
                  : (NSString *)name
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

@end
