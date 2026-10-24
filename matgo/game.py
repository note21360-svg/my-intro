"""
2단계: 한 턴 진행하기

맞고의 한 턴은 두 부분으로 나뉩니다.
  1) 손패에서 카드 한 장을 바닥에 낸다
  2) 더미(뒤집힌 카드 묶음)에서 한 장을 뒤집는다

카드를 낼 때(뒤집을 때도 똑같이) 바닥에 같은 월 카드가
  - 0장 있으면 → 그냥 바닥에 놓는다
  - 1장 있으면 → 그 카드와 내 카드를 둘 다 가져온다
  - 2장 있으면 → 둘 중 하나를 골라서 가져온다
  - 3장 있으면 → 3장 모두 가져온다

※ 뻑, 쪽, 따닥 같은 특수 규칙은 3단계에서 추가합니다.
"""


def find_same_month(floor, card):
    """바닥에서 card와 같은 월인 카드들만 골라서 리스트로 돌려줍니다."""
    return [c for c in floor if c.month == card.month]


def ask_number(message, min_num, max_num):
    """min_num~max_num 사이의 숫자를 입력받을 때까지 계속 물어봅니다."""
    while True:
        answer = input(message)
        if answer.isdigit() and min_num <= int(answer) <= max_num:
            return int(answer)
        print(f"  {min_num}~{max_num} 사이의 숫자를 입력해 주세요.")


def put_card(card, floor, captured, is_human):
    """
    card를 바닥에 내고, 같은 월 카드가 있으면 가져옵니다.
      floor    : 바닥 카드 리스트 (이 함수 안에서 바뀝니다)
      captured : 이 사람이 먹은 카드 리스트 (이 함수 안에서 바뀝니다)
      is_human : 사람이면 True (2장 중 고를 때 입력을 받음)
    """
    matches = find_same_month(floor, card)

    if len(matches) == 0:
        # 같은 월이 없으면 바닥에 놓기만 한다
        floor.append(card)
        print(f"  {card} → 바닥에 놓음")

    elif len(matches) == 1:
        # 1장이면 바로 가져온다
        target = matches[0]
        floor.remove(target)
        captured.extend([card, target])
        print(f"  {card} → {target} 가져옴")

    elif len(matches) == 2:
        # 2장이면 하나를 고른다
        if is_human:
            print(f"  {card}와 같은 월 카드가 2장 있습니다.")
            for i, c in enumerate(matches, start=1):
                print(f"    {i}. {c}")
            choice = ask_number("  어느 카드를 가져올까요? ", 1, 2)
            target = matches[choice - 1]
        else:
            target = choose_best(matches)  # 컴퓨터는 더 좋은 카드를 고른다
        floor.remove(target)
        captured.extend([card, target])
        print(f"  {card} → {target} 가져옴")

    else:
        # 3장이면 모두 가져온다
        for c in matches:
            floor.remove(c)
        captured.append(card)
        captured.extend(matches)
        print(f"  {card} → {matches} 3장 모두 가져옴!")


# 카드 종류별 우선순위 (숫자가 클수록 좋은 카드)
KIND_RANK = {"광": 4, "열끗": 3, "띠": 2, "피": 1}


def choose_best(cards):
    """카드 목록에서 가장 좋은 카드 한 장을 고릅니다. (쌍피는 피보다 좋게)"""
    return max(cards, key=lambda c: (KIND_RANK[c.kind], c.pi_value))


def computer_pick_card(hand, floor):
    """
    컴퓨터가 낼 카드를 고릅니다. (아주 간단한 AI)
      - 바닥에 같은 월이 있는 카드가 있으면 그중 가장 좋은 카드
      - 없으면 가장 안 좋은 카드를 버린다
    """
    can_match = [c for c in hand if find_same_month(floor, c)]
    if can_match:
        return choose_best(can_match)
    return min(hand, key=lambda c: (KIND_RANK[c.kind], c.pi_value))


def play_turn(name, hand, floor, pile, captured, is_human):
    """한 사람의 턴을 진행합니다."""
    print(f"\n===== {name}의 차례 =====")

    # 1) 손패에서 카드 한 장 내기
    if is_human:
        print("[바닥]", sorted(floor, key=lambda c: c.month))
        print("[내 손패]")
        for i, c in enumerate(hand, start=1):
            mark = " ★" if find_same_month(floor, c) else ""  # 먹을 수 있는 카드 표시
            print(f"  {i}. {c}{mark}")
        index = ask_number("낼 카드 번호: ", 1, len(hand))
        card = hand.pop(index - 1)
    else:
        card = computer_pick_card(hand, floor)
        hand.remove(card)

    print(f"{name}이(가) 낸 카드:")
    put_card(card, floor, captured, is_human)

    # 2) 더미에서 한 장 뒤집기
    if pile:
        flipped = pile.pop(0)
        print(f"더미에서 뒤집은 카드:")
        put_card(flipped, floor, captured, is_human)


def show_captured(name, captured):
    """먹은 카드를 종류별로 묶어서 보여줍니다."""
    print(f"[{name} 먹은 카드]")
    for kind in ["광", "열끗", "띠", "피"]:
        cards = [c for c in captured if c.kind == kind]
        print(f"  {kind}({len(cards)}): {cards}")
