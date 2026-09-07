/**
 * FILE: extension-telemetry.ts
 * LAYER: shared/services/monitoring
 * ---------------------------------------------------------------------
 * Relève du journal partagé écrit par les 5 extensions iOS Family Controls.
 *
 * POURQUOI CE RELAIS EXISTE
 *   Une extension est un processus séparé : son crash ou son erreur
 *   n'apparaît JAMAIS dans le rapport de l'app hôte. Et deux d'entre elles ne
 *   peuvent pas héberger de SDK du tout — `RelockActivityReport` n'a aucun
 *   accès réseau (interdiction Apple), `RelockShield` est appelée de façon
 *   synchrone pour dessiner chaque bouclier. Elles écrivent donc dans le
 *   groupe d'app, et l'app relaie au démarrage suivant.
 *
 *   Les trois autres (`RelockMonitor`, `RelockShieldAction`, `RelockWidgets`)
 *   embarquent en plus sentry-cocoa : ce relais couvre leurs erreurs
 *   ATTRAPÉES, leur SDK couvre les crashs DURS. Les deux sont complémentaires.
 *
 * DÉCALAGE ASSUMÉ
 *   Un événement d'extension arrive dans Sentry au prochain lancement de
 *   l'app — parfois des heures plus tard. L'instant réel est conservé dans
 *   `occurred_at` et le tag `deferred` le signale, pour qu'on ne lise pas
 *   l'horodatage de réception comme celui de l'incident.
 * ---------------------------------------------------------------------
 */

import { env } from '@/config/env'
import { ScreenTime } from '@/shared/native/screen-time'
import { addAppBreadcrumb, captureError, isSentryEnabled } from './sentry'

/**
 * Publie le DSN vers le groupe d'app, pour les extensions qui démarrent leur
 * propre SDK. Sans réseau ni `react-native-config`, c'est leur seule source.
 * À appeler même quand Sentry est inactif : publier une chaîne vide efface
 * un DSN laissé par un build précédent.
 */
export function publishSentryDsnToExtensions(): void {
  ScreenTime.publishSentryDSN(isSentryEnabled() ? env.SENTRY_DSN : '').catch(
    () => undefined,
  )
}

/**
 * Vide le journal partagé et transmet son contenu.
 *
 * Le journal est vidé même si Sentry est inactif : le laisser grossir sur un
 * build sans DSN ferait déborder le tampon borné de l'extension, et les
 * entrées les plus anciennes — les seules qui expliquent le début d'une
 * panne — seraient perdues.
 */
export async function drainExtensionTelemetry(): Promise<void> {
  const entries = await ScreenTime.drainExtensionLog()
  if (entries.length === 0 || !isSentryEnabled()) return

  for (const entry of entries) {
    const occurredAt = new Date(entry.ts * 1000).toISOString()

    // Le tampon a débordé : c'est en soi un signal (une extension en boucle
    // d'erreur, ou une app pas lancée depuis longtemps).
    if (entry.droppedBefore) {
      addAppBreadcrumb({
        category: 'extension',
        level: 'warning',
        message: `${entry.droppedBefore} entrée(s) perdue(s) avant celle-ci (tampon plein)`,
      })
    }

    if (entry.kind !== 'error') {
      // Les entrées d'information sont posées EN ORDRE, avant les erreurs qui
      // les suivent : elles deviennent le contexte de ces erreurs.
      addAppBreadcrumb({
        category: `extension.${entry.source}`,
        message: entry.message,
        data: { ...entry.data, occurred_at: occurredAt },
      })
      continue
    }

    captureError(new Error(`[${entry.source}] ${entry.message}`), {
      tags: { extension: entry.source, deferred: 'true' },
      extra: { ...entry.data, occurred_at: occurredAt },
      // Le message est écrit stable côté Swift (aucun identifiant) : il peut
      // donc servir d'empreinte, une issue par panne réelle.
      fingerprint: ['extension', entry.source, entry.message],
    })
  }
}
