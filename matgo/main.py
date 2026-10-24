"""맞고 게임 실행 파일 (1단계: 카드 나누기 확인)"""

from cards import make_deck, deal


def main():
    deck = make_deck()
    print(f"전체 카드 수: {len(deck)}장")

    player, computer, floor, pile = deal(deck)

    # 보기 좋게 월 순서로 정렬해서 출력
    player.sort(key=lambda c: c.month)
    floor.sort(key=lambda c: c.month)

    print("\n[내 손패]")
    for i, card in enumerate(player, start=1):
        print(f"  {i}. {card}")

    print("\n[바닥 카드]")
    print("  ", floor)

    print(f"\n컴퓨터 손패: {len(computer)}장 (비공개)")
    print(f"남은 더미: {len(pile)}장")


if __name__ == "__main__":
    main()
