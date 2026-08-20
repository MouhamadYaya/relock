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

RCT_EXTERN_METHOD(bindSelection
                  : (nonnull NSString *)ruleId
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startTimedBlock
                  : (nonnull NSString *)ruleId
                  minutes : (nonnull NSNumber *)minutes
                  strict : (BOOL)strict
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startSchedule
                  : (nonnull NSString *)ruleId
                  startHour : (nonnull NSNumber *)startHour
                  startMinute : (nonnull NSNumber *)startMinute
                  endHour : (nonnull NSNumber *)endHour
                  endMinute : (nonnull NSNumber *)endMinute
                  days : (nonnull NSArray *)days
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startDailyLimit
                  : (nonnull NSString *)ruleId
                  minutes : (nonnull NSNumber *)minutes
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopRule
                  : (nonnull NSString *)ruleId
                  kind : (nonnull NSString *)kind
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(suspendRule
                  : (nonnull NSString *)ruleId until
                  : (nonnull NSNumber *)until resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(resumeRule
                  : (nonnull NSString *)ruleId resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearRuleData
                  : (nonnull NSString *)ruleId
                  kind : (nonnull NSString *)kind
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopBlocking
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(limitSteps
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getStatus
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(pullEvents
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(ackEvents
                  : (nonnull NSNumber *)count
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(resetIfFreshInstall
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

// --- Notifications locales ---

RCT_EXTERN_METHOD(requestNotifPermission
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(notifPermissionStatus
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(scheduleNotif
                  : (nonnull NSString *)id
                  timestamp : (nonnull NSNumber *)timestamp
                  title : (nonnull NSString *)title
                  body : (nonnull NSString *)body
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(cancelNotifsWithPrefix
                  : (nonnull NSString *)prefix
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setCelebrationsEnabled
                  : (BOOL)enabled
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(armedActivities
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getDiagnostics
                  : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end
