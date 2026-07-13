#import <React/RCTViewManager.h>
#import <React/RCTLegacyViewManagerInteropComponentView.h>

@interface RCT_EXTERN_MODULE (ScreenTimeReportViewManager, RCTViewManager)
RCT_EXPORT_VIEW_PROPERTY(period, NSNumber)
@end

// Enregistre cette vue legacy dans la couche d'interop Fabric (New Architecture),
// sinon le composant ne s'affiche pas (carte vide).
@interface ScreenTimeReportInterop : NSObject
@end
@implementation ScreenTimeReportInterop
+ (void)load
{
  [RCTLegacyViewManagerInteropComponentView
      supportLegacyViewManagerWithName:@"ScreenTimeReportView"];
}
@end
