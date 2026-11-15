import { useMemo, useState } from 'react'
import { ArrowLeft, Archive as ArchiveIcon, Trash2 } from 'lucide-react'
import { DIFFICULTY_LABEL } from '../activities/labels'
import { ACTIVITIES, getActivity } from '../activities/registry'
import { Button, LinkButton } from '../components/Button'
import { Chip } from '../components/Chip'
import { ConfirmModal } from '../components/ConfirmModal'
import { EmptyState } from '../components/EmptyState'
import { GrowthChart } from '../components/GrowthChart'
import { MeasuredStats, OutputView } from '../components/OutputView'
import { ResultView } from '../components/ResultView'
import { Stat } from '../components/Stat'
import { formatDateTime, formatTime, groupByDate, growthSeries, shortDate, summarize } from '../lib/archive'
import { deleteSession, getSessions } from '../lib/storage'
import { paths } from '../router'
import type { ActivityId, SessionRecord } from '../types'

type Filter = ActivityId | 'all'
type Confirm = 'one' | 'all' | null

const MAX_COMPARE = 2

const nameOf = (id: string) => getActivity(id)?.name ?? id

function ComparePanel({ records }: { records: SessionRecord[] }) {
  return (
    <div className="compare">
      {records.map((s) => (
        <article key={s.id} className="compare__col" aria-label={`${nameOf(s.activityId)} ${formatDateTime(s.completedAt)}`}>
          <p className="label">{formatDateTime(s.completedAt)}</p>
          <OutputView session={s} />
          <MeasuredStats session={s} />
        </article>
      ))}
    </div>
  )
}

export function Archive() {
  const [sessions, setSessions] = useState<SessionRecord[]>(() => getSessions())
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [confirm, setConfirm] = useState<Confirm>(null)

  const reload = () => setSessions(getSessions())

  const summary = useMemo(() => summarize(sessions), [sessions])
  const filtered = useMemo(
    () => (filter === 'all' ? sessions : sessions.filter((s) => s.activityId === filter)),
    [sessions, filter],
  )
  const groups = useMemo(() => groupByDate(filtered), [filtered])

  const filterActivity = filter === 'all' ? undefined : getActivity(filter)
  const growth = useMemo(
    () => (filterActivity && filterActivity.kind !== 'open' ? growthSeries(sessions, filterActivity.id) : []),
    [sessions, filterActivity],
  )
  const comparable = filterActivity?.kind === 'open'
  const compared = compareIds
    .map((id) => sessions.find((s) => s.id === id))
    .filter((s): s is SessionRecord => s !== undefined)

  const selected = selectedId ? sessions.find((s) => s.id === selectedId) : undefined

  const changeFilter = (next: Filter) => {
    setFilter(next)
    setCompareIds([])
    if (selected && next !== 'all' && selected.activityId !== next) setSelectedId(null)
  }

  const toggleCompare = (id: string) =>
    setCompareIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < MAX_COMPARE ? [...ids, id] : ids))

  const confirmDelete = () => {
    if (confirm === 'one' && selected) {
      deleteSession(selected.id)
      setSelectedId(null)
      setCompareIds((ids) => ids.filter((x) => x !== selected.id))
    } else if (confirm === 'all') {
      for (const s of getSessions()) deleteSession(s.id) // sessions only: AI consent stays as it is
      setSelectedId(null)
      setCompareIds([])
      setFilter('all')
    }
    setConfirm(null)
    reload()
  }

  const storageNote = <p className="label-ko archive__note">기록은 이 브라우저에만 저장됩니다. 다른 기기와 동기화되지 않습니다.</p>

  if (sessions.length === 0) {
    return (
      <main className="page archive">
        <EmptyState
          icon={<ArchiveIcon size={28} />}
          title="아직 기록이 없습니다"
          body="활동을 하나 끝내면 결과가 여기에 쌓입니다."
          action={
            <LinkButton href={`#${paths.discover()}`} size="lg">
              첫 활동 시작하기
            </LinkButton>
          }
        />
        {storageNote}
      </main>
    )
  }

  return (
    <main className="page archive">
      <h1 className="display h1">ARCHIVE</h1>

      <section className="archive__summary" aria-label="요약">
        <Stat label="TOTAL" value={summary.total} unit="회" />
        <Stat label="LAST 7 DAYS" value={summary.last7Days} unit="회" />
        <Stat
          label="MOST"
          value={summary.most ? `${nameOf(summary.most.activityId)}` : '—'}
          unit={summary.most ? `${summary.most.count}회` : undefined}
        />
      </section>

      <div className="archive__filters" role="group" aria-label="활동 필터">
        <button type="button" className="filter" aria-pressed={filter === 'all'} onClick={() => changeFilter('all')}>
          ALL
        </button>
        {ACTIVITIES.map((a) => (
          <button
            key={a.id}
            type="button"
            className="filter"
            aria-pressed={filter === a.id}
            onClick={() => changeFilter(a.id)}
          >
            {a.name}
          </button>
        ))}
      </div>

      <div className="archive__body" data-view={selected ? 'detail' : 'list'}>
        <nav className="archive__list" aria-label="기록 목록">
          {groups.length === 0 ? <p className="prose">이 활동의 기록이 아직 없습니다.</p> : null}
          {groups.map((g) => (
            <section key={g.key} className="archive__group">
              <h2 className="label archive__date">{shortDate(g.key)}</h2>
              <ul>
                {g.sessions.map((s) => (
                  <li key={s.id} className="archive__item">
                    {comparable ? (
                      <input
                        type="checkbox"
                        className="archive__check"
                        aria-label={`${formatTime(s.completedAt)} 기록 비교에 추가`}
                        checked={compareIds.includes(s.id)}
                        disabled={!compareIds.includes(s.id) && compareIds.length >= MAX_COMPARE}
                        onChange={() => toggleCompare(s.id)}
                      />
                    ) : null}
                    <button
                      type="button"
                      className="archive__open"
                      aria-current={s.id === selectedId ? 'true' : undefined}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <span className="archive__name">{nameOf(s.activityId)}</span>
                      <span className="label">
                        {formatTime(s.completedAt)} · {DIFFICULTY_LABEL[s.difficulty]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <div className="archive__main">
          <div className="archive__detail">
            {selected ? (
              <>
                <div className="archive__bar">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="archive__back"
                    icon={<ArrowLeft size={16} aria-hidden="true" />}
                    onClick={() => setSelectedId(null)}
                  >
                    목록
                  </Button>
                  <Button variant="ghost" size="sm" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => setConfirm('one')}>
                    이 기록 삭제
                  </Button>
                </div>
                <ResultView key={selected.id} sessionId={selected.id} embedded />
              </>
            ) : (
              <p className="prose archive__placeholder">왼쪽 목록에서 기록을 고르면 결과가 여기에 열립니다.</p>
            )}
          </div>

          <div className="archive__panels">
            {filterActivity && !comparable ? (
              <section className="archive__panel" aria-label="GROWTH">
                <h2 className="label">GROWTH · {filterActivity.name}</h2>
                <GrowthChart points={growth} activityName={filterActivity.name} />
              </section>
            ) : null}
            {comparable && filterActivity ? (
              <section className="archive__panel" aria-label="COMPARE">
                <h2 className="label">COMPARE · {filterActivity.name}</h2>
                {compared.length === MAX_COMPARE ? (
                  <ComparePanel records={compared} />
                ) : (
                  <p className="prose">같은 활동의 기록을 2개 체크하면 결과물과 조건 충족 지표를 나란히 볼 수 있습니다. ({compared.length}/2)</p>
                )}
              </section>
            ) : null}
            {filter === 'all' ? (
              <p className="prose archive__hint">
                활동 필터를 고르면 객관·혼합 활동은 성장 추이를, 개방형 활동은 기록 비교를 볼 수 있습니다.{' '}
                <Chip>점수 합산 없음</Chip>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <footer className="archive__foot">
        {storageNote}
        <Button variant="ghost" size="sm" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => setConfirm('all')}>
          전체 삭제
        </Button>
      </footer>

      <ConfirmModal
        open={confirm !== null}
        title={confirm === 'all' ? '모든 기록을 삭제할까요?' : '이 기록을 삭제할까요?'}
        body={
          confirm === 'all'
            ? `저장된 기록 ${sessions.length}건이 이 브라우저에서 사라지며 되돌릴 수 없습니다.`
            : '삭제하면 되돌릴 수 없습니다.'
        }
        confirmLabel="삭제"
        cancelLabel="취소"
        onConfirm={confirmDelete}
        onCancel={() => setConfirm(null)}
      />
    </main>
  )
}
