#import <React/RCTBridgeModule.h>

// Expose le module Swift `RelockTracking` (App Tracking Transparency) au
// bridge React Native.
@interface RCT_EXTERN_MODULE (RelockTracking, NSObject)

RCT_EXTERN_METHOD(status
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(request
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

@end
