"""맞고 게임 실행 파일 (2단계: 손패가 다 떨어질 때까지 턴 진행)"""

from cards import make_deck, deal
from game import play_turn, show_captured


def main():
    deck = make_deck()
    player, computer, floor, pile = deal(deck)
    player.sort(key=lambda c: c.month)

    player_captured = []    # 내가 먹은 카드
    computer_captured = []  # 컴퓨터가 먹은 카드

    # 손패가 10장이니까 서로 10번씩 번갈아 진행
    while player or computer:
        if player:
            play_turn("나", player, floor, pile, player_captured, is_human=True)
        if computer:
            play_turn("컴퓨터", computer, floor, pile, computer_captured, is_human=False)

    print("\n===== 게임 끝 =====")
    show_captured("나", player_captured)
    show_captured("컴퓨터", computer_captured)
    print(f"남은 바닥 카드: {floor}")


if __name__ == "__main__":
    main()
