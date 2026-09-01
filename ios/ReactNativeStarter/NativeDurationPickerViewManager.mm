#import <React/RCTLegacyViewManagerInteropComponentView.h>
#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE (NativeDurationPickerViewManager, RCTViewManager)
RCT_EXPORT_VIEW_PROPERTY(minutes, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(minimumMinutes, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(maximumMinutes, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(minuteInterval, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(onChange, RCTDirectEventBlock)
@end

// Rend la vue UIKit legacy disponible sous Fabric / New Architecture.
@interface NativeDurationPickerInterop : NSObject
@end

@implementation NativeDurationPickerInterop
+ (void)load
{
  [RCTLegacyViewManagerInteropComponentView
      supportLegacyViewManagerWithName:@"NativeDurationPickerView"];
}
@end
