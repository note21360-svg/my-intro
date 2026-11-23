"""
간단한 4키 리듬게임 (Python + pygame)

실행 방법:
    pip install pygame
    python rhythm_game.py

조작:
    D  F  J  K  : 4개 레인의 노트 치기
    SPACE       : 게임 시작 / 다시 시작
    ESC         : 종료
"""

import array
import math
import sys

import pygame

# ─────────────────────────────────────────────
# 1. 기본 설정값 (숫자를 바꿔 가며 실험해 보세요!)
# ─────────────────────────────────────────────
SCREEN_W = 480          # 화면 가로 크기(픽셀)
SCREEN_H = 720          # 화면 세로 크기(픽셀)
FPS = 120               # 1초에 화면을 몇 번 그릴지

BPM = 120               # 곡의 빠르기 (1분에 박자 수)
NOTE_SPEED = 0.6        # 노트가 떨어지는 속도 (픽셀 / 밀리초)
START_DELAY = 2000      # 시작 후 첫 박자까지 기다리는 시간(밀리초)

LANE_KEYS = [pygame.K_d, pygame.K_f, pygame.K_j, pygame.K_k]
LANE_NAMES = ["D", "F", "J", "K"]
LANE_COLORS = [(255, 90, 120), (90, 200, 255), (90, 200, 255), (255, 90, 120)]
LANE_W = 80             # 레인 하나의 너비
LANE_LEFT = (SCREEN_W - LANE_W * 4) // 2   # 첫 레인의 왼쪽 x좌표 (가운데 정렬)
JUDGE_Y = SCREEN_H - 120                   # 판정선의 y좌표

# 판정 범위 (밀리초). 노트 시간과 누른 시간의 차이가 이 안에 들어오면 해당 판정
JUDGES = [
    ("PERFECT", 40, 300, (255, 230, 90)),
    ("GREAT",   80, 200, (120, 255, 150)),
    ("GOOD",   120, 100, (120, 180, 255)),
]
MISS_WINDOW = 150       # 이보다 늦으면 MISS

# ─────────────────────────────────────────────
# 2. 채보(노트 배치표)
#    한 줄 = 반 박자(8분음표). 4글자 = 4개 레인(D F J K)
#    '1' = 노트 있음, '.' = 없음
#    직접 고쳐서 나만의 채보를 만들어 보세요!
# ─────────────────────────────────────────────
CHART_TEXT = """
1...
....
.1..
....
..1.
....
...1
....
1...
.1..
..1.
...1
1..1
....
.11.
....
1...
..1.
.1..
...1
1...
..1.
.1..
...1
11..
....
..11
....
1.1.
.1.1
1.1.
.1.1
1...
.1..
..1.
...1
..1.
.1..
1...
....
1..1
....
1..1
....
.11.
.11.
1111
....
"""


def load_chart(text):
    """채보 텍스트를 [(시간ms, 레인번호), ...] 리스트로 바꿔 줍니다."""
    half_beat_ms = 60000 / BPM / 2          # 반 박자가 몇 밀리초인지
    notes = []
    rows = [r for r in text.strip().splitlines() if r.strip()]
    for row_index, row in enumerate(rows):
        for lane, ch in enumerate(row[:4]):
            if ch == "1":
                hit_time = START_DELAY + row_index * half_beat_ms
                notes.append({"time": hit_time, "lane": lane, "done": False})
    song_length = START_DELAY + len(rows) * half_beat_ms
    return notes, song_length


# ─────────────────────────────────────────────
# 3. 효과음 만들기 (음악 파일 없이 코드로 소리 생성)
# ─────────────────────────────────────────────
def make_tone(freq, duration_ms, volume=0.5, decay=8.0):
    """사인파(sine wave)로 짧은 '삑' 소리를 만듭니다."""
    sample_rate = 44100
    n = int(sample_rate * duration_ms / 1000)
    samples = array.array("h")              # 'h' = 16비트 정수
    for i in range(n):
        t = i / sample_rate
        envelope = math.exp(-decay * t * 1000 / duration_ms)   # 점점 작아지게
        value = math.sin(2 * math.pi * freq * t) * envelope * volume
        samples.append(int(value * 32767))
    return pygame.mixer.Sound(buffer=samples.tobytes())


# ─────────────────────────────────────────────
# 4. 게임 본체
# ─────────────────────────────────────────────
class Game:
    def __init__(self):
        pygame.mixer.pre_init(44100, -16, 1, 256)
        pygame.init()
        self.screen = pygame.display.set_mode((SCREEN_W, SCREEN_H))
        pygame.display.set_caption("Simple Rhythm Game")
        self.clock = pygame.time.Clock()

        self.font_big = pygame.font.SysFont(None, 72)
        self.font = pygame.font.SysFont(None, 40)
        self.font_small = pygame.font.SysFont(None, 28)

        # 효과음 준비
        self.beat_sound = make_tone(220, 80, volume=0.35)       # 박자 소리 (낮은 음)
        self.accent_sound = make_tone(440, 90, volume=0.45)     # 마디 첫 박 (높은 음)
        self.hit_sound = make_tone(880, 60, volume=0.3, decay=12)

        self.state = "title"     # title → play → result
        self.reset()

    def reset(self):
        """새 게임을 위해 점수와 노트를 초기화합니다."""
        self.notes, self.song_length = load_chart(CHART_TEXT)
        self.score = 0
        self.combo = 0
        self.max_combo = 0
        self.counts = {"PERFECT": 0, "GREAT": 0, "GOOD": 0, "MISS": 0}
        self.last_judge = None          # (글자, 색, 표시된 시각)
        self.pressed = [False] * 4      # 지금 눌려 있는 레인
        self.next_beat = 0              # 다음에 울릴 박자 번호
        self.start_ticks = 0

    def now(self):
        """게임 시작 후 지난 시간(밀리초)."""
        return pygame.time.get_ticks() - self.start_ticks

    # ── 판정 ───────────────────────────────
    def set_judge(self, name, color):
        self.last_judge = (name, color, self.now())

    def hit_lane(self, lane):
        """레인 키를 눌렀을 때: 그 레인에서 가장 가까운 노트를 찾아 판정."""
        t = self.now()
        target = None
        for note in self.notes:
            if note["lane"] == lane and not note["done"]:
                if abs(note["time"] - t) <= MISS_WINDOW:
                    target = note
                    break          # 노트는 시간순이므로 첫 번째가 가장 가까움
        if target is None:
            return                 # 근처에 노트가 없으면 아무 일도 없음

        diff = abs(target["time"] - t)
        target["done"] = True
        for name, window, points, color in JUDGES:
            if diff <= window:
                self.combo += 1
                self.max_combo = max(self.max_combo, self.combo)
                self.score += points + self.combo * 2   # 콤보 보너스
                self.counts[name] += 1
                self.set_judge(name, color)
                self.hit_sound.play()
                return
        # 판정 범위 밖(너무 이르게 누름) → MISS
        self.miss()

    def miss(self):
        self.combo = 0
        self.counts["MISS"] += 1
        self.set_judge("MISS", (255, 80, 80))

    # ── 매 프레임 업데이트 ─────────────────
    def update(self):
        t = self.now()

        # 박자 소리: 박자 시간이 되면 '틱' 소리
        beat_ms = 60000 / BPM
        while START_DELAY + self.next_beat * beat_ms <= t and \
                START_DELAY + self.next_beat * beat_ms < self.song_length:
            if self.next_beat % 4 == 0:
                self.accent_sound.play()
            else:
                self.beat_sound.play()
            self.next_beat += 1

        # 놓친 노트 처리: 판정선을 지나 너무 오래되면 MISS
        for note in self.notes:
            if not note["done"] and t - note["time"] > MISS_WINDOW:
                note["done"] = True
                self.miss()

        # 곡이 끝나면 결과 화면으로
        if t > self.song_length + 1000:
            self.state = "result"

    # ── 그리기 ─────────────────────────────
    def draw_text(self, text, font, color, center):
        img = font.render(text, True, color)
        self.screen.blit(img, img.get_rect(center=center))

    def draw_play(self):
        t = self.now()
        self.screen.fill((15, 15, 25))

        # 레인 배경
        for i in range(4):
            x = LANE_LEFT + i * LANE_W
            bg = (35, 35, 55) if not self.pressed[i] else (60, 60, 95)
            pygame.draw.rect(self.screen, bg, (x, 0, LANE_W, SCREEN_H))
            pygame.draw.line(self.screen, (70, 70, 100), (x, 0), (x, SCREEN_H))
        pygame.draw.line(self.screen, (70, 70, 100),
                         (LANE_LEFT + 4 * LANE_W, 0), (LANE_LEFT + 4 * LANE_W, SCREEN_H))

        # 판정선
        pygame.draw.rect(self.screen, (230, 230, 230),
                         (LANE_LEFT, JUDGE_Y - 3, LANE_W * 4, 6))

        # 노트: 판정선까지 남은 시간 × 속도 = 판정선 위쪽 거리
        for note in self.notes:
            if note["done"]:
                continue
            y = JUDGE_Y - (note["time"] - t) * NOTE_SPEED
            if y < -30:
                break              # 화면 위쪽 밖 → 그 뒤 노트도 다 밖이므로 중단
            x = LANE_LEFT + note["lane"] * LANE_W
            pygame.draw.rect(self.screen, LANE_COLORS[note["lane"]],
                             (x + 6, y - 10, LANE_W - 12, 20), border_radius=6)

        # 키 이름 표시
        for i in range(4):
            x = LANE_LEFT + i * LANE_W + LANE_W // 2
            color = (255, 255, 255) if self.pressed[i] else (140, 140, 170)
            self.draw_text(LANE_NAMES[i], self.font, color, (x, JUDGE_Y + 50))

        # 판정 글자 (0.5초 동안 표시)
        if self.last_judge and t - self.last_judge[2] < 500:
            name, color, _ = self.last_judge
            self.draw_text(name, self.font_big, color, (SCREEN_W // 2, SCREEN_H // 2 - 40))
        if self.combo >= 2:
            self.draw_text(f"{self.combo} COMBO", self.font, (255, 255, 255),
                           (SCREEN_W // 2, SCREEN_H // 2 + 10))

        # 점수
        self.draw_text(f"SCORE {self.score}", self.font_small, (255, 255, 255),
                       (SCREEN_W // 2, 25))

    def draw_title(self):
        self.screen.fill((15, 15, 25))
        self.draw_text("RHYTHM GAME", self.font_big, (255, 230, 90), (SCREEN_W // 2, 220))
        self.draw_text("Keys:  D  F  J  K", self.font, (200, 200, 230), (SCREEN_W // 2, 330))
        self.draw_text("Press SPACE to start", self.font, (255, 255, 255), (SCREEN_W // 2, 420))
        self.draw_text("ESC to quit", self.font_small, (140, 140, 170), (SCREEN_W // 2, 470))

    def draw_result(self):
        self.screen.fill((15, 15, 25))
        total = len(self.notes)
        # 정확도: PERFECT=100%, GREAT=70%, GOOD=40%, MISS=0%
        acc = (self.counts["PERFECT"] * 1.0 + self.counts["GREAT"] * 0.7
               + self.counts["GOOD"] * 0.4) / total * 100 if total else 0
        rank = "S" if acc >= 95 else "A" if acc >= 85 else "B" if acc >= 70 else "C" if acc >= 50 else "D"

        self.draw_text("RESULT", self.font_big, (255, 230, 90), (SCREEN_W // 2, 110))
        self.draw_text(f"RANK  {rank}", self.font_big, (255, 255, 255), (SCREEN_W // 2, 200))
        lines = [
            f"Score      {self.score}",
            f"Accuracy   {acc:.1f}%",
            f"Max Combo  {self.max_combo}",
            f"Perfect    {self.counts['PERFECT']}",
            f"Great      {self.counts['GREAT']}",
            f"Good       {self.counts['GOOD']}",
            f"Miss       {self.counts['MISS']}",
        ]
        for i, line in enumerate(lines):
            self.draw_text(line, self.font, (220, 220, 240), (SCREEN_W // 2, 290 + i * 42))
        self.draw_text("SPACE: retry   ESC: quit", self.font_small, (140, 140, 170),
                       (SCREEN_W // 2, SCREEN_H - 50))

    # ── 메인 루프 ──────────────────────────
    def run(self):
        while True:
            # (1) 입력 처리
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    return
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        return
                    if event.key == pygame.K_SPACE and self.state in ("title", "result"):
                        self.reset()
                        self.start_ticks = pygame.time.get_ticks()
                        self.state = "play"
                    elif self.state == "play" and event.key in LANE_KEYS:
                        lane = LANE_KEYS.index(event.key)
                        self.pressed[lane] = True
                        self.hit_lane(lane)
                if event.type == pygame.KEYUP and event.key in LANE_KEYS:
                    self.pressed[LANE_KEYS.index(event.key)] = False

            # (2) 상태 업데이트 + (3) 그리기
            if self.state == "play":
                self.update()
                self.draw_play()
            elif self.state == "title":
                self.draw_title()
            else:
                self.draw_result()

            pygame.display.flip()
            self.clock.tick(FPS)


if __name__ == "__main__":
    Game().run()
    pygame.quit()
    sys.exit()
