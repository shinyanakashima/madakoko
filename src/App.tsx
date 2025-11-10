import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { CircularProgressbarWithChildren, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

// 会議室マスタ
const ROOMS: Record<number, string> = {
	331: "カンムリワシ",
	332: "ハイビスカス",
	333: "がじゅまる",
};

// 予約情報（親子でやり取りする形）
type ReservationSummary = {
	employee_name: string;
	meeting_name: string;
	start_datetime: string; // "YYYY-MM-DD HH:mm" JST
	end_datetime: string; // "YYYY-MM-DD HH:mm" JST
	isOngoing: boolean;
};

// APIレスポンスの予約1件分
type ReservationApi = {
	employee_name: string;
	meeting_name: string;
	start_datetime: string;
	end_datetime: string;
};

/* -------------------- ルートレイアウト -------------------- */

export default function CountdownLayout() {
	const [showModal, setShowModal] = useState(false);
	const [seatId, setSeatId] = useState<number>(333);
	const [countdownTarget, setCountdownTarget] = useState<string | null>(null); // "YYYY-MM-DD HH:mm"
	const [countdownLabel, setCountdownLabel] = useState<string>("開始まで");

	return (
		<div className='min-h-screen bg-slate-50 text-slate-900'>
			{/* Header */}
			<header className='sticky top-0 z-10 border-b bg-white/80 backdrop-blur'>
				<div className='mx-auto flex max-w-6xl items-center justify-between px-6 py-4'>
					<h1 className='text-3xl font-extrabold'>まだココ？</h1>
					<div className='flex items-center gap-3'>
						<span className='text-base text-slate-500'>イノベ課</span>
						<label className='text-sm text-slate-500' htmlFor='room'>
							会議室
						</label>
						<select
							id='room'
							className='rounded-xl border px-3 py-1.5 text-base shadow-sm hover:bg-slate-50'
							value={seatId}
							onChange={(e: ChangeEvent<HTMLSelectElement>) =>
								setSeatId(Number(e.target.value))
							}>
							<option value={333}>がじゅまる (333)</option>
							<option value={332}>ハイビスカス (332)</option>
							<option value={331}>カンムリワシ (331)</option>
						</select>
						<a
							href='https://office.zukoshait.org/destinations/'
							target='_blank'
							rel='noopener noreferrer'
							className='ml-2 rounded-xl border px-3 py-1.5 text-base shadow-sm hover:bg-slate-50 text-slate-700'>
							行き先一覧 ↗
						</a>
					</div>
				</div>
			</header>

			{/* Body: Left | Right */}
			<main className='mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-6 md:grid-cols-2'>
				{/* Left Column */}
				<section className='rounded-2xl bg-white p-6 shadow-sm'>
					<NextReservation
						seatId={seatId}
						onNextChange={(r) => {
							if (!r) {
								setCountdownTarget(null);
								return;
							}
							const ongoing = r.isOngoing;
							setCountdownTarget(ongoing ? r.end_datetime : r.start_datetime);
							setCountdownLabel(ongoing ? "終了まで" : "開始まで");
						}}
					/>
				</section>

				{/* Right Column with Circular Countdown */}
				<section className='relative rounded-2xl bg-white p-6 shadow-sm'>
					<h2 className='mb-6 text-3xl font-bold'>次の会議まで</h2>
					<div className='flex items-center justify-center'>
						<CountdownCircle
							targetJst={countdownTarget || undefined}
							durationSeconds={10} // フォールバック
							sizePx={300}
							strokeWidth={10}
							labelText={countdownLabel}
							onComplete={() => setShowModal(true)}
						/>
					</div>
				</section>
			</main>

			{/* 完了モーダル */}
			{showModal && (
				<Modal onClose={() => setShowModal(false)}>
					<div className='flex flex-col items-center gap-3 p-2'>
						<div className='text-2xl font-bold'>まもなく会議が終了します</div>
						<p className='text-lg text-slate-600'>ご準備ください。</p>
						<button
							onClick={() => setShowModal(false)}
							className='mt-3 rounded-xl border bg-white px-5 py-2 text-base shadow-sm hover:bg-slate-50'
							autoFocus>
							閉じる
						</button>
					</div>
				</Modal>
			)}
		</div>
	);
}

/* -------------------- 共通ユーティリティ -------------------- */

function formatHMS(totalMs: number): string {
	const total = Math.max(0, Math.floor(totalMs / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
	return `${m}:${String(s).padStart(2, "0")}`;
}

/* -------------------- カウントダウンコンポーネント -------------------- */

type CountdownCircleProps = {
	/** "YYYY-MM-DD HH:mm" JST */
	targetJst?: string;
	durationSeconds?: number;
	sizePx?: number;
	strokeWidth?: number;
	onComplete?: () => void;
	labelText?: string;
};

/**
 * 右: targetJst ("YYYY-MM-DD HH:mm" JST) に向けたカウントダウン。
 * targetJst が未指定なら durationSeconds を使うフォールバック。
 */
function CountdownCircle({
	targetJst,
	durationSeconds = 10,
	sizePx = 200,
	strokeWidth = 12,
	onComplete,
	labelText,
}: CountdownCircleProps) {
	const formatShort = (ms: number): string => {
		const sec = Math.ceil(ms / 1000);
		if (sec < 60) return `${sec} 秒`;
		const min = Math.ceil(sec / 60);
		if (min < 60) return `${min} 分`;
		const hr = Math.ceil(min / 60);
		if (hr < 24) return `${hr} 時間`;
		const days = Math.ceil(hr / 24);
		return `${days} 日`;
	};

	const parseJst = (s: string): Date => new Date(s.replace(" ", "T") + "+09:00");
	const computeEnd = (): number =>
		targetJst
			? parseJst(targetJst).getTime()
			: Date.now() + Math.max(0, durationSeconds * 1000);

	const [endAt, setEndAt] = useState<number>(computeEnd());
	const [initialTotal, setInitialTotal] = useState<number>(Math.max(0, endAt - Date.now()));
	const [remainingMs, setRemainingMs] = useState<number>(initialTotal);
	const [fired, setFired] = useState<boolean>(false);

	// targetJst / duration が変わったらリセット
	useEffect(() => {
		const nextEnd = computeEnd();
		setEndAt(nextEnd);
		const initial = Math.max(0, nextEnd - Date.now());
		setInitialTotal(initial);
		setRemainingMs(initial);
		setFired(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [targetJst, durationSeconds]);

	// 250ms 間隔で更新
	useEffect(() => {
		const id = setInterval(() => {
			const remain = Math.max(0, endAt - Date.now());
			setRemainingMs(remain);
			if (remain <= 0) {
				clearInterval(id);
				if (!fired) {
					setFired(true);
					onComplete?.();
				}
			}
		}, 250);
		return () => clearInterval(id);
	}, [endAt, fired, onComplete]);

	const percent = useMemo(() => {
		if (!initialTotal) return 0;
		return (remainingMs / initialTotal) * 100;
	}, [remainingMs, initialTotal]);

	return (
		<div className='flex flex-col items-center gap-4'>
			<div style={{ width: sizePx, height: sizePx }}>
				<CircularProgressbarWithChildren
					value={percent}
					strokeWidth={strokeWidth}
					styles={buildStyles({
						pathTransitionDuration: 0.2,
						trailColor: "#e5e7eb",
						textColor: "#0f172a",
						pathColor:
							percent <= 10 ? "#ef4444" : percent <= 30 ? "#f59e0b" : "#22c55e",
					})}>
					<div className='flex flex-col items-center justify-center'>
						<span className='text-2xl text-slate-500'>
							{labelText ?? (targetJst ? "開始まで" : "残り")}
						</span>
						<span className='text-6xl font-extrabold tabular-nums'>
							{formatHMS(remainingMs)}
						</span>
					</div>
				</CircularProgressbarWithChildren>
			</div>
			<div className='text-2xl text-slate-500'>
				約{formatShort(remainingMs)}お待ちください
			</div>
		</div>
	);
}

/* -------------------- モーダル -------------------- */

type ModalProps = {
	children: ReactNode;
	onClose: () => void;
};

function Modal({ children, onClose }: ModalProps) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<div
			className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'
			role='dialog'
			aria-modal='true'>
			<div className='w-full max-w-sm rounded-2xl border bg-white p-6 shadow-xl'>
				<div className='flex justify-end'>
					<button
						aria-label='閉じる'
						onClick={onClose}
						className='-mr-1 -mt-1 rounded-full p-1 text-slate-400 hover:text-slate-600'>
						<span className='text-xl'>×</span>
					</button>
				</div>
				{children}
			</div>
		</div>
	);
}

/* -------------------- 左カラム：次の予約 -------------------- */

type NextReservationProps = {
	seatId: number;
	onNextChange?: (reservation: ReservationSummary | null) => void;
};

// Intl.DateTimeFormat#formatToParts 用の型
type DateParts = {
	month?: string;
	day?: string;
	weekday?: string;
};

function NextReservation({ seatId, onNextChange }: NextReservationProps) {
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [reservation, setReservation] = useState<ReservationSummary | null>(null);

	// JSTの今週（日曜始まり）を計算して、ISO8601(+09:00)で文字列化
	const buildWeekRangeJst = (): { start: string; end: string } => {
		const now = new Date();
		const todayStr = `${now.toISOString().split("T")[0]}T00:00:00+09:00`;
		const today = new Date(todayStr);
		const weekdayIdx = today.getDay();

		const startDate = new Date(todayStr);
		startDate.setDate(startDate.getDate() - weekdayIdx);

		const endDate = new Date(startDate);
		endDate.setDate(endDate.getDate() + 7); // 翌週開始（[start, end)）

		const toIsoJst = (dt: Date): string => {
			const yy = dt.getFullYear();
			const mm = String(dt.getMonth() + 1).padStart(2, "0");
			const dd = String(dt.getDate()).padStart(2, "0");
			return `${yy}-${mm}-${dd}T00:00:00+09:00`;
		};

		return { start: toIsoJst(startDate), end: toIsoJst(endDate) };
	};

	useEffect(() => {
		const abort = new AbortController();
		const { start, end } = buildWeekRangeJst();
		const url = `/reservations/api/future-reservations?seat_id=${seatId}&start_date=${encodeURIComponent(
			start
		)}&end_date=${encodeURIComponent(end)}`;

		(async () => {
			try {
				setLoading(true);
				setError(null);

				const res = await fetch(url, { signal: abort.signal });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);

				const data: unknown = await res.json();
				const list: ReservationApi[] = Array.isArray((data as any)?.reservations)
					? (data as any).reservations
					: [];

				const nowJst = new Date();
				const toDateJst = (s: string): Date => new Date(s.replace(" ", "T") + "+09:00");

				// 終了が未来（= 現在以降にかかっている or これから始まる）を対象
				const candidate = list
					.map((r: ReservationApi) => ({
						employee_name: r.employee_name,
						meeting_name: r.meeting_name,
						start_datetime: r.start_datetime,
						end_datetime: r.end_datetime,
						start: toDateJst(r.start_datetime),
						end: toDateJst(r.end_datetime),
					}))
					.filter((r) => r.end.getTime() > nowJst.getTime())
					.sort((a, b) => a.start.getTime() - b.start.getTime())[0];

				if (candidate) {
					const isOngoing = candidate.start.getTime() <= nowJst.getTime();
					const picked: ReservationSummary = {
						employee_name: candidate.employee_name,
						meeting_name: candidate.meeting_name,
						start_datetime: candidate.start_datetime,
						end_datetime: candidate.end_datetime,
						isOngoing,
					};
					setReservation(picked);
					onNextChange?.(picked);
				} else {
					setReservation(null);
					onNextChange?.(null);
				}
			} catch (e: unknown) {
				if (e instanceof DOMException && e.name === "AbortError") {
					// ignore
				} else {
					setError(e instanceof Error ? e.message : String(e));
				}
			} finally {
				setLoading(false);
			}
		})();

		return () => abort.abort();
	}, [seatId, onNextChange]);

	const formatDateJp = (start: string): string => {
		const d = new Date(start.replace(" ", "T") + "+09:00");
		const fmt = new Intl.DateTimeFormat("ja-JP", {
			timeZone: "Asia/Tokyo",
			month: "2-digit",
			day: "2-digit",
			weekday: "short",
		});

		const parts = fmt.formatToParts(d).reduce<DateParts>((acc, p) => {
			if (p.type === "month" || p.type === "day" || p.type === "weekday") {
				acc[p.type] = p.value;
			}
			return acc;
		}, {});

		const month = parts.month ?? "";
		const day = parts.day ?? "";
		const weekday = parts.weekday ?? "";
		return `${month}/${day}(${weekday})`;
	};

	const formatRange = (start: string, end: string): string => {
		const toHm = (s: string): string => s.split(" ")[1]?.slice(0, 5) ?? s;
		return `${toHm(start)}-${toHm(end)}`;
	};

	if (loading) return <div className='text-lg text-slate-500'>読み込み中…</div>;
	if (error) return <div className='text-lg text-red-600'>読み込みエラー: {String(error)}</div>;
	if (!reservation) return <div className='text-lg text-slate-500'>今週の予約はありません。</div>;

	return (
		<div>
			<h2 className='mb-4 text-3xl font-extrabold'>
				{reservation.isOngoing ? "会議中" : "次の会議がはじまります"}（
				{ROOMS[seatId] ?? String(seatId)}）
			</h2>
			<div className='space-y-2'>
				<div className='text-2xl font-semibold text-slate-700'>
					{formatDateJp(reservation.start_datetime)}{" "}
					{formatRange(reservation.start_datetime, reservation.end_datetime)}
				</div>
				<div className='text-3xl font-extrabold text-slate-900'>
					{reservation.meeting_name}
				</div>
				<div className='text-xl text-slate-600'>{reservation.employee_name}さん</div>
			</div>
		</div>
	);
}
