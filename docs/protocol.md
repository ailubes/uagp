# UAGP: початковий федеративний протокол

**Статус:** пропозиція v0.1, не затверджений державний стандарт.

Мета протоколу – забезпечити сумісний обмін перевіреними подіями та управлінськими модулями між вузлами громад без передачі повних приватних чатів.

## Базові сутності

`CitizenDraft`, `OfficialCase`, `PublicProposal`, `EvidenceRecord`, `AuthorityDecision`, `ChangeProposal`, `PolicyBundle`, `EvaluationManifest`, `ReleaseRecord`, `OutcomeReview`, `AppealRecord`.

## Приклади маршруту HTTP API (не реалізовано)

```text
POST /v1/drafts
POST /v1/drafts/{id}/confirm
POST /v1/proposals
GET  /v1/proposals/{id}
POST /v1/federation/events
POST /v1/change-proposals
POST /v1/policy-bundles/verify
GET  /v1/audit/proof/{id}
```

## Початкові типи подій

```text
ua.gov.proposal.confirmed.v1
ua.gov.proposal.routed.v1
ua.gov.change.reviewed.v1
ua.gov.policy.release.approved.v1
ua.gov.policy.released.v1
ua.gov.outcome.reviewed.v1
```

Кожне повідомлення повинно мати версію схеми, походження, технічну цілісність і обмежений обсяг даних. Підпис події не є доказом законності адміністративної дії. Одержувач повторно перевіряє компетенцію та чинну політику.

## Значуща участь та Participation Steward

Громадянський протокол повинен забезпечувати супровід ініціативи після її подання. Новий компонент **Participation Steward** відстежує відповідальну роль, наступну змістовну дію, перешкоди, можливість мотивованої відповіді та добровільні способи участі. Він не має права змінювати юридичне рішення, закривати прострочені справи без пояснення чи перетворювати модельну підказку на повноваження. Деталі – [специфікація Participation Steward](participation-steward.md).

## Пропозиції до наступного RFC

Потрібно зафіксувати канонічну JSON Schema, OpenAPI-контракти, механізм підпису, ідемпотентність, юридичні атрибути `AuthorityRegistry`, правила видалення даних і стратегію сумісності версій.

Повний робочий матеріал – [RFC-UAGP-0001 у Google Docs](https://docs.google.com/document/d/1n8BfMn5W1U_NESedHHNNdmEmN3bZjSbNDDXtghwXHF4/edit). Цей GitHub-файл є коротким відкритим оглядом, а не його дослівною копією.
