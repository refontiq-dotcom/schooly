import { LegalShell } from "../legal-shell"

export default function TarifsPage() {
  return (
    <LegalShell
      title="Conditions tarifaires et facturation"
      intro="Le tarif Schooly est calculé selon le nombre d’élèves facturables de l’établissement pour chaque année scolaire."
    >
      <h2>1. Tarif</h2>
      <p>
        Le tarif de référence de Schooly est fixé à <strong>1 000 FCFA par élève et par année scolaire</strong>.
      </p>

      <h2>2. Élève facturable</h2>
      <p>
        Pour la facturation annuelle, Schooly comptabilise les inscriptions de l’établissement
        confirmées pour l’année scolaire concernée. Un même élève n’est compté qu’une fois pour
        une même année scolaire.
      </p>
      <p>
        Un ancien élève réinscrit au titre d’une nouvelle année scolaire est à nouveau facturable.
        Un nouvel élève confirmé au cours de l’année scolaire est également facturable pour cette
        année selon les règles du service.
      </p>

      <h2>3. Exemple</h2>
      <p>
        Un établissement comptant 350 élèves facturables pour une année scolaire doit
        <strong> 350 000 FCFA</strong> pour cette année.
      </p>

      <h2>4. Calcul automatisé</h2>
      <p>
        Le calcul est effectué à partir des données d’inscription déjà présentes dans Schooly.
        L’établissement n’a pas à déclarer manuellement son effectif pour que Schooly établisse
        son décompte.
      </p>

      <h2>5. Facture et traçabilité</h2>
      <p>
        La facture conserve le nombre d’élèves pris en compte, le tarif unitaire, l’année scolaire,
        le montant total et le statut de paiement. Une facture déjà établie ne doit pas être
        recalculée rétroactivement simplement parce que l’effectif évolue ensuite.
      </p>

      <h2>6. Frais annexes de l’établissement</h2>
      <p>
        La facture Schooly est due par l’établissement. L’établissement reste libre d’organiser
        ses propres frais d’inscription et frais annexes, dans le respect de la réglementation
        applicable. Refontiq ne fixe pas les frais facturés par l’établissement aux élèves ou à
        leurs représentants et ne perçoit pas directement ces frais annexes.
      </p>

      <h2>7. Utilisation du tarif Schooly</h2>
      <p>
        La contribution annuelle participe au financement du fonctionnement du SaaS, notamment
        l’hébergement, les bases de données, les sauvegardes, la sécurité, la maintenance technique,
        les mises à jour, la surveillance de l’infrastructure, le développement continu et le support.
      </p>

      <h2>8. Paiement et impayés</h2>
      <p>
        Les modalités d’échéance, les moyens de paiement acceptés et les conséquences d’un impayé
        sont indiqués sur la facture et dans les conditions commerciales applicables. Toute mesure
        de suspension doit respecter les obligations contractuelles et les éventuelles dispositions
        impératives applicables.
      </p>

      <h2>9. Contestation d’un décompte</h2>
      <p>
        L’établissement peut demander une vérification du décompte en indiquant son numéro de facture,
        son année scolaire et le motif de la contestation. Schooly doit permettre de retrouver le
        nombre d’inscriptions ayant servi au calcul.
      </p>
    </LegalShell>
  )
}
