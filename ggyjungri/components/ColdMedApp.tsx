"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { Classes, Ingredient, Major, Minor, Product, Series } from "@/lib/types";

type Props = { classes: Classes; ingredients: Ingredient[]; series: Series[]; products: Product[] };
type Group = { m: Major; subs: { c: Minor; rows: Ingredient[] }[] };

const MAX_PICK = 4;
const STORAGE_KEY = "coldmed";

const TYPE_LABEL = { cold: "종합감기", cough: "목감기", nose: "코감기" } as const;
type TypeKey = keyof typeof TYPE_LABEL;
type BaseKey = "aap" | "nsaid" | "none";
const BASE_LABEL: Record<BaseKey, string> = { aap: "AAP 기반", nsaid: "NSAIDs 기반", none: "진통 성분 없음" };

const fmt = (v: number) => (Math.round(v * 100) / 100).toLocaleString("ko-KR");

export default function ColdMedApp({ classes, ingredients, series, products }: Props) {
  const [daily, setDaily] = useState(true); // 기본 보기: 1일 최대 (PRD 5장)
  const [on, setOn] = useState<Set<string>>(() => new Set(series.map((s) => s.id)));
  const [pick, setPick] = useState<string[]>([]);
  const [tab, setTab] = useState<"prod" | "cmp">("prod");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  // 정렬: 시리즈별 / 성분 함량순 (선택한 성분이 든 품목만, 함량 많은순·적은순)
  const [sortMode, setSortMode] = useState<"series" | "ing">("series");
  const [ingSel, setIngSel] = useState("");
  const [desc, setDesc] = useState(true);
  // 필터: 증상 유형, 진통 성분 기반 (빈 문자열 = 전체)
  const [typeF, setTypeF] = useState<TypeKey | "">("");
  const [baseF, setBaseF] = useState<BaseKey | "">("");
  const [q, setQ] = useState(""); // 제품명·성분명 검색
  // 필터 창(바텀시트): 열 때 지금 값을 복사해 두고, [적용]을 눌러야 반영
  type Draft = { on: Set<string>; typeF: TypeKey | ""; baseF: BaseKey | ""; sortMode: "series" | "ing"; ingSel: string; desc: boolean };
  const allSeries = () => new Set(series.map((x) => x.id));
  const defaults = (): Draft => ({ on: allSeries(), typeF: "", baseF: "", sortMode: "series", ingSel: "", desc: true });
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState<Draft>(defaults);
  const openSheet = () => { setDraft({ on: new Set(on), typeF, baseF, sortMode, ingSel, desc }); setSheet(true); };
  const applySheet = () => {
    setOn(draft.on.size ? new Set(draft.on) : allSeries());
    setTypeF(draft.typeF); setBaseF(draft.baseF); setSortMode(draft.ingSel ? draft.sortMode : "series");
    setIngSel(draft.ingSel); setDesc(draft.desc); setSheet(false); window.scrollTo(0, 0);
  };
  const d = (patch: Partial<Draft>) => setDraft((cur) => ({ ...cur, ...patch }));
  const toggleDraftSeries = (id: string) =>
    setDraft((cur) => {
      const n = new Set(cur.on.size === series.length ? [] : cur.on); // 전체 상태에서 하나 누르면 그 시리즈만
      if (n.has(id)) n.delete(id); else n.add(id);
      return { ...cur, on: n.size ? n : allSeries() };
    });
  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSheet(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [sheet]);

  // 저장된 비교 선택 불러오기 (실패해도 앱은 정상 동작)
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (Array.isArray(s.pick)) {
        setPick(s.pick.filter((id: string) => products.some((p) => p.id === id)).slice(0, MAX_PICK));
      }
    } catch {}
  }, [products]);

  const seriesById = useMemo(() => new Map(series.map((s) => [s.id, s])), [series]);
  const ingById = useMemo(() => new Map(ingredients.map((g) => [g.id, g])), [ingredients]);
  const minorById = useMemo(() => new Map(classes.minor.map((c) => [c.id, c])), [classes]);

  // 시리즈 순서 → 같은 시리즈 안에서는 배열 순서
  const ordered = useMemo(() => {
    const idx = new Map(series.map((s, i) => [s.id, i]));
    return products
      .map((p, i) => ({ p, i }))
      .sort((a, b) => (idx.get(a.p.series) ?? 99) - (idx.get(b.p.series) ?? 99) || a.i - b.i)
      .map((x) => x.p);
  }, [products, series]);

  const amt = (p: Product, id: string) => {
    const v = p.ingredients[id] || 0;
    return daily ? v * p.perDoseMax * p.timesPerDayMax : v * p.perDoseMax;
  };

  // 막대 최대길이 = 전체 품목 중 해당 성분 최고값 (시리즈 필터와 무관)
  const topById = useMemo(() => {
    const t = new Map<string, number>();
    for (const p of products)
      for (const [id, v] of Object.entries(p.ingredients)) {
        const a = daily ? v * p.perDoseMax * p.timesPerDayMax : v * p.perDoseMax;
        t.set(id, Math.max(t.get(id) || 0, a));
      }
    return t;
  }, [products, daily]);

  // 대분류 → 소분류 → 성분 묶음. has(g) = 이 성분을 보여줄지
  const tree = (has: (g: Ingredient) => boolean): Group[] =>
    classes.major
      .map((m) => ({
        m,
        subs: classes.minor
          .filter((c) => c.major === m.id)
          .map((c) => ({ c, rows: ingredients.filter((g) => g.class === c.id && has(g)) }))
          .filter((x) => x.rows.length),
      }))
      .filter((x) => x.subs.length);

  // 소분류 이름이 대분류와 같으면(기타) 소분류 제목을 숨기고 대분류 옆에 색상 네모
  const soloColor = (m: Major, subs: Group["subs"]) =>
    subs.length === 1 && subs[0].c.name === m.name ? subs[0].c.color : null;

  const Bar = ({ p, id }: { p: Product; id: string }) => {
    const top = topById.get(id) || 1;
    const color = minorById.get(ingById.get(id)?.class || "")?.color;
    return (
      <div className="trk">
        <i style={{ width: `${(amt(p, id) / top) * 100}%`, background: color }} />
      </div>
    );
  };

  const Flags = ({ p }: { p: Product }) => {
    const gs = Object.keys(p.ingredients).map((k) => ingById.get(k));
    const f: React.ReactNode[] = [];
    if (gs.some((g) => g?.sedating)) f.push(<span key="s" className="flag f-a">졸음 주의</span>);
    if (gs.some((g) => g?.pregnancyDUR2)) f.push(<span key="p" className="flag f-w">임부금기 2등급 성분</span>);
    if (gs.some((g) => g?.caffeine)) f.push(<span key="c" className="flag f-c">카페인</span>);
    if (!p.verified) f.push(<span key="q" className="flag f-q">확인 필요</span>);
    return f.length ? <>{f}</> : null;
  };

  const doseBasis = (p: Product) =>
    daily ? `1일 최대 (1회 ${p.perDoseMax}${p.unit} × ${p.timesPerDayMax}회)` : `1회 ${p.perDoseMax}${p.unit}`;

  const togglePick = (id: string) => {
    setPick((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < MAX_PICK ? [...cur, id] : cur;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ pick: next }));
      } catch {}
      return next;
    });
  };

  const goTab = (t: "prod" | "cmp") => {
    setTab(t);
    window.scrollTo(0, 0);
  };

  // 진통 성분 기반: 해열진통제(아세트아미노펜) 함유 → AAP, NSAIDs(이부프로펜 등) 함유 → NSAIDs
  const baseOf = (p: Product): BaseKey => {
    const cls = Object.keys(p.ingredients).map((k) => ingById.get(k)?.class);
    return cls.includes("ns") ? "nsaid" : cls.includes("ap") ? "aap" : "none";
  };
  const qn = q.trim().toLowerCase().replace(/\s+/g, "");
  const matchQ = (p: Product) =>
    !qn ||
    p.name.replace(/\s+/g, "").toLowerCase().includes(qn) ||
    Object.keys(p.ingredients).some((k) => {
      const g = ingById.get(k);
      return !!g && (g.ko.toLowerCase().includes(qn) || g.en.toLowerCase().replace(/\s+/g, "").includes(qn));
    });
  const visible = ordered.filter((p) => on.has(p.series) && (!typeF || p.type === typeF) && (!baseF || baseOf(p) === baseF) && matchQ(p));
  const ingMode = sortMode === "ing" && !!ingSel;
  const listed = ingMode
    ? visible
        .filter((p) => p.ingredients[ingSel])
        .sort((a, b) => (desc ? -1 : 1) * (amt(a, ingSel) - amt(b, ingSel)) || a.name.localeCompare(b.name, "ko"))
    : visible;
  // 성분 선택 목록: 소분류별로 묶고, 지금 보이는 시리즈 중 그 성분이 든 품목 수 표시
  const ingGroups = classes.minor
    .map((c) => ({
      c,
      items: ingredients
        .filter((g) => g.class === c.id)
        .map((g) => ({ g, n: products.filter((p) => p.ingredients[g.id]).length }))
        .filter((x) => x.n > 0),
    }));
  // 대분류 → 소분류 묶음 (성분 없는 소분류도 남겨 '해당 없음'으로 표시)
  const ingTree = classes.major.map((m) => ({ m, subs: ingGroups.filter((x) => x.c.major === m.id) }));
  const picked = pick.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p);

  return (
    <>
      <div className="top">
        <div className="wrap">
          <div className="row">
            <h1>종합감기약 성분 비교</h1>
            <div className="seg" role="group" aria-label="용량 기준">
              <button aria-pressed={!daily} onClick={() => setDaily(false)}>1회</button>
              <button aria-pressed={daily} onClick={() => setDaily(true)}>1일 최대</button>
            </div>
          </div>
          <p className="rule">
            {daily
              ? "1일 최대 = 1회 최대 정수 × 1일 최대 횟수 (성인 최대 용법 기준) · 막대 최대길이 = 전체 품목 중 해당 성분 최고용량"
              : "1회 = 성인 1회 최대 정수 기준 · 막대 최대길이 = 전체 품목 중 해당 성분 최고용량"}
          </p>
          <div className="tabs" role="tablist">
            <button className="tab" role="tab" aria-selected={tab === "prod"} onClick={() => goTab("prod")}>
              제품
            </button>
            <button className="tab" role="tab" aria-selected={tab === "cmp"} onClick={() => goTab("cmp")}>
              비교<span className="n">{pick.length}</span>
            </button>
          </div>
        </div>
      </div>

      <main className="wrap">
        {tab === "prod" ? (
          <section>
            <div className="fbar">
              <span className="fico" aria-hidden="true">☰</span>
              <span className="fsum">
                <b>{typeF ? TYPE_LABEL[typeF] : "전체 유형"}</b>
                {baseF && <> · <b>{baseF === "aap" ? "AAP" : "NSAIDs"}</b></>}
                {" · "}시리즈: <b>{on.size === series.length ? "전체" : series.filter((x) => on.has(x.id)).map((x) => x.name).slice(0, 2).join("·") + (on.size > 2 ? ` 외 ${on.size - 2}` : "")}</b>
                {" · "}<b>{ingMode ? `${ingById.get(ingSel)?.ko} ${desc ? "많은" : "적은"}순` : "시리즈별"}</b>
                {" · "}{listed.length}개
              </span>
              <button className="fbtn" onClick={openSheet}>필터</button>
            </div>
            <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="제품명·성분명 검색" aria-label="제품명·성분명 검색" />
            {ingMode && <p className="note sortnote">{ingById.get(ingSel)?.ko} 함유 {listed.length}개 · {daily ? "1일 최대" : "1회"} 기준 {desc ? "많은" : "적은"}순</p>}
            {sheet && (
              <div className="sheet-bg" onClick={() => setSheet(false)}>
                <div className="sheet" role="dialog" aria-modal="true" aria-label="필터" onClick={(e) => e.stopPropagation()}>
                  <div className="grab" aria-hidden="true" />
                  <div className="sheet-body">
                    <h4>증상 유형</h4>
                    <div className="pills">
                      <button aria-pressed={draft.typeF === ""} onClick={() => d({ typeF: "" })}>전체</button>
                      {(Object.keys(TYPE_LABEL) as TypeKey[]).map((k) => (
                        <button key={k} aria-pressed={draft.typeF === k} onClick={() => d({ typeF: k })}>{TYPE_LABEL[k]}</button>
                      ))}
                    </div>
                    <h4>진통 성분</h4>
                    <div className="pills">
                      <button aria-pressed={draft.baseF === ""} onClick={() => d({ baseF: "" })}>전체</button>
                      <button aria-pressed={draft.baseF === "aap"} onClick={() => d({ baseF: "aap" })}>AAP 기반</button>
                      <button aria-pressed={draft.baseF === "nsaid"} onClick={() => d({ baseF: "nsaid" })}>NSAIDs 기반</button>
                    </div>
                    <h4>시리즈</h4>
                    <div className="pills">
                      <button aria-pressed={draft.on.size === series.length} onClick={() => d({ on: allSeries() })}>전체</button>
                      {series.map((x) => (
                        <button key={x.id} aria-pressed={draft.on.size !== series.length && draft.on.has(x.id)} onClick={() => toggleDraftSeries(x.id)}>{x.name}</button>
                      ))}
                    </div>
                    <h4>정렬</h4>
                    <div className="pills">
                      <button aria-pressed={draft.sortMode === "series"} onClick={() => d({ sortMode: "series" })}>시리즈별</button>
                      <button aria-pressed={draft.sortMode === "ing" && draft.desc} onClick={() => d({ sortMode: "ing", desc: true })}>성분 많은순</button>
                      <button aria-pressed={draft.sortMode === "ing" && !draft.desc} onClick={() => d({ sortMode: "ing", desc: false })}>성분 적은순</button>
                    </div>
                    {draft.sortMode === "ing" && (
                      <>
                        <h4>정렬할 성분 <span className="meta">고른 성분이 든 품목만 표시</span></h4>
                        {ingTree.map(({ m, subs }) => (
                          <div className="pmaj" key={m.id}>
                            <div className="pmh">{m.name}</div>
                            {subs.map(({ c, items }) => (
                              <div className="pgrp" key={c.id}>
                                {!(subs.length === 1 && c.name === m.name) && (
                                  <div className="pgh"><span className="sw" style={{ background: c.color }} />{c.name}</div>
                                )}
                                {items.length ? (
                                  <div className="pills">
                                    {items.map(({ g, n }) => (
                                      <button key={g.id} aria-pressed={draft.ingSel === g.id} onClick={() => d({ ingSel: g.id })}>{g.ko} <small>{n}</small></button>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="none">해당 없음</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                  <div className="sheet-foot">
                    <button className="ghost" onClick={() => setDraft(defaults())}>초기화</button>
                    <button className="primary" onClick={applySheet} disabled={draft.sortMode === "ing" && !draft.ingSel}>
                      {draft.sortMode === "ing" && !draft.ingSel ? "성분을 고르세요" : "적용"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="cards">
              {visible.length === 0 && <div className="empty">조건에 맞는 품목이 없습니다. 필터나 검색어를 바꿔 보세요.</div>}
              {listed.map((p, idx) => {
                const s = seriesById.get(p.series);
                const newSeries = !ingMode && (idx === 0 || listed[idx - 1].series !== p.series);
                const nInSeries = listed.filter((x) => x.series === p.series).length;
                const isOn = pick.includes(p.id);
                const full = !isOn && pick.length >= MAX_PICK;
                return (
                  <Fragment key={p.id}>
                  {newSeries && (
                    <h2 className="sh">
                      {s?.name} <span className="meta">{s?.maker} · {nInSeries}개</span>
                    </h2>
                  )}
                  <article className="card">
                    {ingMode && (
                      <div className="hl">
                        <span className="rk">{idx + 1}</span>
                        {ingById.get(ingSel)?.ko}
                        <b>{fmt(amt(p, ingSel))}<small> mg</small></b>
                      </div>
                    )}
                    <div className="ch">
                      <div>
                        <h3>{p.name}</h3>
                        <div className="meta">
                          {s?.name} · {s?.maker}
                          {p.permitHolder && p.permitHolder !== s?.maker && <> (허가: {p.permitHolder})</>}
                        </div>
                      </div>
                      <label className="pick" title="비교에 담기">
                        <input
                          type="checkbox"
                          checked={isOn}
                          disabled={full}
                          onChange={() => togglePick(p.id)}
                          aria-label={`${p.name} 비교에 담기`}
                        />
                        <span>비교</span>
                      </label>
                    </div>
                    <div>
                      <span className="tag">{TYPE_LABEL[p.type]}</span>
                      <span className="tag">{BASE_LABEL[baseOf(p)]}</span>
                      <Flags p={p} />
                    </div>
                    <details
                      className="acc"
                      open={open.has(p.id)}
                      onToggle={(e) => {
                        const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                        setOpen((cur) => {
                          if (cur.has(p.id) === isOpen) return cur;
                          const n = new Set(cur);
                          if (isOpen) n.add(p.id); else n.delete(p.id);
                          return n;
                        });
                      }}
                    >
                      <summary>
                        제품 정보 <span className="meta">제형 · 포장단위 · 연령 · 용법 · 가격</span>
                      </summary>
                      <dl className="specs">
                        <dt>제형</dt><dd>{p.form}</dd>
                        <dt>포장단위</dt><dd>{p.pack}</dd>
                        <dt>연령</dt><dd>{p.age}</dd>
                        <dt>용법</dt><dd>{p.dosageText}</dd>
                        <dt>기준</dt><dd>{doseBasis(p)}</dd>
                        <dt>가격</dt><dd className="meta">{p.price != null ? `${p.price.toLocaleString("ko-KR")}원` : "추후 업데이트"}</dd>
                      </dl>
                    </details>
                    {tree((g) => !!p.ingredients[g.id]).map(({ m, subs }) => {
                      const sc = soloColor(m, subs);
                      return (
                        <div className="cg" key={m.id}>
                          <div className="cgh">
                            {sc && <span className="sw" style={{ background: sc }} />}
                            {m.name}
                          </div>
                          {subs.map(({ c, rows }) => (
                            <div key={c.id}>
                              {c.name !== m.name && (
                                <div className="csh">
                                  <span className="sw" style={{ background: c.color }} />
                                  {c.name}
                                </div>
                              )}
                              {rows.map((g) => (
                                <div className={`ib${ingMode && g.id === ingSel ? " on" : ""}`} key={g.id}>
                                  <div className="ibh">
                                    <span>{g.ko}</span>
                                    <b>{fmt(amt(p, g.id))}<small> mg</small></b>
                                  </div>
                                  <Bar p={p} id={g.id} />
                                  <div className="ibs">{g.en}</div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {p.durNotes.map((n) => (
                      <div className="note" style={{ marginTop: 6 }} key={n}>DUR {n}</div>
                    ))}
                  </article>
                  </Fragment>
                );
              })}
            </div>
          </section>
        ) : (
          <section>
            <p className="note" style={{ marginTop: 0 }}>
              최대 4개까지 고르세요. 한쪽에만 있는 성분은 굵게 표시합니다.
            </p>
            <div className="sel">
              {ordered.map((p) => {
                const isOn = pick.includes(p.id);
                return (
                  <button
                    key={p.id}
                    aria-pressed={isOn}
                    disabled={!isOn && pick.length >= MAX_PICK}
                    onClick={() => togglePick(p.id)}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
            {picked.length < 2 ? (
              <div className="empty">비교할 품목을 2개 이상 고르세요. 지금 {picked.length}개 선택됨.</div>
            ) : (
              <div className="scroll">
                <table className="ct">
                  <thead>
                    <tr>
                      <th className="rl">{daily ? "1일 최대" : "1회"} (mg)</th>
                      {picked.map((p) => (
                        <th key={p.id}>
                          {p.name}
                          <div className="meta">
                            {seriesById.get(p.series)?.name} ·{" "}
                            {daily ? `${p.perDoseMax}${p.unit}×${p.timesPerDayMax}회` : `${p.perDoseMax}${p.unit}`}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="grp">
                      <td className="rl">제품 정보</td>
                      <td colSpan={picked.length} />
                    </tr>
                    {([["제형", "form"], ["포장단위", "pack"], ["연령", "age"], ["용법", "dosageText"]] as const).map(
                      ([label, f]) => (
                        <tr key={f}>
                          <td className="rl">{label}</td>
                          {picked.map((p) => <td key={p.id}>{p[f]}</td>)}
                        </tr>
                      ),
                    )}
                    <tr>
                      <td className="rl">주의</td>
                      {picked.map((p) => (
                        <td key={p.id}><Flags p={p} /></td>
                      ))}
                    </tr>
                    {tree((g) => picked.some((p) => p.ingredients[g.id])).map(({ m, subs }) => {
                      const sc = soloColor(m, subs);
                      return [
                        <tr className="grp" key={m.id}>
                          <td className="rl">
                            {sc && <span className="sw" style={{ background: sc }} />}
                            {m.name}
                          </td>
                          <td colSpan={picked.length} />
                        </tr>,
                        ...subs.flatMap(({ c, rows }) => [
                          c.name !== m.name && (
                            <tr className="sub" key={c.id}>
                              <td className="rl">
                                <span className="sw" style={{ background: c.color }} />
                                {c.name}
                              </td>
                              <td colSpan={picked.length} />
                            </tr>
                          ),
                          ...rows.map((g) => {
                            const only = picked.some((p) => !p.ingredients[g.id]);
                            return (
                              <tr className={only ? "only" : ""} key={g.id}>
                                <td className="rl">
                                  <span>{g.ko}</span>
                                  <div className="meta">{g.en}</div>
                                </td>
                                {picked.map((p) =>
                                  p.ingredients[g.id] ? (
                                    <td key={p.id}>
                                      <span className="v">{fmt(amt(p, g.id))}</span>
                                      <Bar p={p} id={g.id} />
                                    </td>
                                  ) : (
                                    <td key={p.id} className="meta">–</td>
                                  ),
                                )}
                              </tr>
                            );
                          }),
                        ]),
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <h2>출처</h2>
        <ul className="src">
          {ordered.map((p) => {
            const s = seriesById.get(p.series);
            const maker = p.sources.maker || s?.homepage;
            return (
              <li key={p.id}>
                {p.name}:{" "}
                {p.sources.kpic && <><a href={p.sources.kpic} target="_blank" rel="noreferrer">약학정보원</a> · </>}
                {p.sources.mfds && <><a href={p.sources.mfds} target="_blank" rel="noreferrer">식약처 {p.mfdsCode}</a></>}
                {maker && <> · <a href={maker} target="_blank" rel="noreferrer">{s?.maker} 홈페이지</a></>}
                <span className="meta"> · 확인 {p.checkedAt}{p.permitHolder && p.permitHolder !== s?.maker ? ` · 허가: ${p.permitHolder}` : ""}</span>
                {p.notes && <div className="meta">{p.notes}</div>}
              </li>
            );
          })}
        </ul>
        <p className="note">
          출처는 약학정보원, 식약처 의약품안전나라, 각 제약사 홈페이지입니다. 성분·함량·용법·제형·연령은 약학정보원과
          식약처 허가정보 기준이며, 성분명은 허가사항 표기 그대로 적었습니다. 소아용 품목은 제외했습니다. 임부금기 2등급
          표시는 약학정보원 DUR에 표기된 성분(구아이페네신, 페닐레프린, 슈도에페드린, 이부프로펜)을 성분 단위로 적용했고,
          졸음 표시는 1세대 항히스타민제 함유 기준입니다. 가격은 추후 업데이트 예정입니다. 이 앱은 상담 보조용이며,
          최종 판단은 허가사항 원문을 확인하세요.
        </p>
      </main>

      {tab === "prod" && pick.length > 0 && (
        <div className="float">
          <span>{pick.length}개 선택 (최대 4개)</span>
          <button onClick={() => goTab("cmp")}>비교하기</button>
        </div>
      )}
    </>
  );
}
