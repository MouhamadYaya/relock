#import <React/RCTViewManager.h>
#import <React/RCTLegacyViewManagerInteropComponentView.h>

@interface RCT_EXTERN_MODULE (BlockedAppIconsViewManager, RCTViewManager)
RCT_EXPORT_VIEW_PROPERTY(tokenKey, NSString)
RCT_EXPORT_VIEW_PROPERTY(reloadToken, NSNumber)
@end

// Enregistre cette vue legacy dans la couche d'interop Fabric (New Architecture),
// sinon le composant ne s'affiche pas (rangée vide) — même mécanisme que
// ScreenTimeReportViewManager.
@interface BlockedAppIconsInterop : NSObject
@end
@implementation BlockedAppIconsInterop
+ (void)load
{
  [RCTLegacyViewManagerInteropComponentView
      supportLegacyViewManagerWithName:@"BlockedAppIconsView"];
}
@end
