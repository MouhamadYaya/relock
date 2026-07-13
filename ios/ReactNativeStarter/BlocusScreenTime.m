#import <React/RCTBridgeModule.h>

// Expose le module Swift `BlocusScreenTime` au bridge React Native.
@interface RCT_EXTERN_MODULE (BlocusScreenTime, NSObject)

RCT_EXTERN_METHOD(requestAuthorization
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(authorizationStatus
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(presentPicker
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startTimedBlock
                  : (nonnull NSNumber *)minutes
                  strict : (BOOL)strict
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startSchedule
                  : (nonnull NSNumber *)startHour
                  startMinute : (nonnull NSNumber *)startMinute
                  endHour : (nonnull NSNumber *)endHour
                  endMinute : (nonnull NSNumber *)endMinute
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startDailyLimit
                  : (nonnull NSNumber *)minutes
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopBlocking
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getStatus
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(pullEvents
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end
