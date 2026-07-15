import ActivityKit
import SwiftUI
import WidgetKit

/// Live Activity « Bloquer maintenant » de Relock.
///
/// Visible pendant un blocage MINUTÉ uniquement (démarrée/terminée par
/// `BlocusScreenTime`) : carte sur l'écran verrouillé + Dynamic Island avec
/// la main levée, l'anneau de progression et le compte à rebours. Le timer
/// et l'anneau sont rendus par le système (`timerInterval`) — aucune mise à
/// jour n'est nécessaire pendant toute la durée du blocage.
@main
struct RelockWidgetsBundle: WidgetBundle {
  var body: some Widget {
    if #available(iOS 16.2, *) {
      RelockBlockLiveActivity()
    }
  }
}

@available(iOS 16.2, *)
struct RelockBlockLiveActivity: Widget {

  private let accent = Color(red: 0.643, green: 0.604, blue: 0.996) // #A49AFE
  private let ink2 = Color(white: 0.72)

  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RelockBlockAttributes.self) { context in
      // ── Écran verrouillé / bannière ──────────────────────────────
      lockScreen(context)
        .activityBackgroundTint(Color.black.opacity(0.85))
        .activitySystemActionForegroundColor(accent)
    } dynamicIsland: { context in
      DynamicIsland {
        // ── Île étendue (appui long) ───────────────────────────────
        DynamicIslandExpandedRegion(.leading) {
          handRing(context, size: 44, lineWidth: 4)
            .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.center) {
          VStack(alignment: .leading, spacing: 2) {
            Text("Blocage en cours")
              .font(.system(size: 15, weight: .bold))
              .foregroundColor(.white)
            Text(appsLabel(context.attributes.count))
              .font(.system(size: 12))
              .foregroundColor(ink2)
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          VStack(alignment: .trailing, spacing: 2) {
            countdown(context)
              .font(.system(size: 24, weight: .bold, design: .rounded))
              .foregroundColor(accent)
              .frame(maxWidth: 72)
            Text("restant")
              .font(.system(size: 11))
              .foregroundColor(ink2)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack(spacing: 4) {
            Text(context.state.startDate, style: .time)
            Text("–")
            Text(context.state.endDate, style: .time)
          }
          .font(.system(size: 12, weight: .medium))
          .foregroundColor(ink2)
        }
      } compactLeading: {
        // ── Pilule compacte : main + mini anneau ───────────────────
        handRing(context, size: 22, lineWidth: 2.5)
      } compactTrailing: {
        countdown(context)
          .font(.system(size: 14, weight: .semibold, design: .rounded))
          .foregroundColor(accent)
          .frame(maxWidth: 46)
      } minimal: {
        handRing(context, size: 22, lineWidth: 2.5)
      }
      .keylineTint(accent)
    }
  }

  // MARK: - Composants

  /// Main levée entourée de l'anneau de progression (système, auto-animé).
  @ViewBuilder
  private func handRing(
    _ context: ActivityViewContext<RelockBlockAttributes>,
    size: CGFloat,
    lineWidth: CGFloat
  ) -> some View {
    ZStack {
      ProgressView(
        timerInterval: context.state.startDate...context.state.endDate,
        countsDown: false,
        label: { EmptyView() },
        currentValueLabel: { EmptyView() }
      )
      .progressViewStyle(.circular)
      .tint(accent)
      Image(systemName: "hand.raised.fill")
        .font(.system(size: size * 0.42, weight: .semibold))
        .foregroundColor(accent)
    }
    .frame(width: size, height: size)
  }

  /// Compte à rebours système (se met à jour seul, sans réveiller l'app).
  private func countdown(
    _ context: ActivityViewContext<RelockBlockAttributes>
  ) -> some View {
    Text(
      timerInterval: context.state.startDate...context.state.endDate,
      countsDown: true
    )
    .monospacedDigit()
    .multilineTextAlignment(.trailing)
  }

  private func appsLabel(_ count: Int) -> String {
    count == 1 ? "1 app bloquée" : "\(count) apps bloquées"
  }

  // ── Carte écran verrouillé ────────────────────────────────────────
  @ViewBuilder
  private func lockScreen(
    _ context: ActivityViewContext<RelockBlockAttributes>
  ) -> some View {
    HStack(spacing: 14) {
      handRing(context, size: 52, lineWidth: 5)

      VStack(alignment: .leading, spacing: 3) {
        HStack(spacing: 4) {
          Text(context.state.startDate, style: .time)
          Text("–")
          Text(context.state.endDate, style: .time)
        }
        .font(.system(size: 13, weight: .medium))
        .foregroundColor(ink2)
        Text("Bloquer")
          .font(.system(size: 19, weight: .bold))
          .foregroundColor(.white)
        Text(appsLabel(context.attributes.count))
          .font(.system(size: 13))
          .foregroundColor(ink2)
      }

      Spacer(minLength: 8)

      VStack(alignment: .trailing, spacing: 3) {
        countdown(context)
          .font(.system(size: 30, weight: .bold, design: .rounded))
          .foregroundColor(accent)
          .frame(maxWidth: 96)
        Text("restant")
          .font(.system(size: 13))
          .foregroundColor(ink2)
      }
    }
    .padding(16)
  }
}
