package com.cartlens.window;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;

import org.junit.jupiter.api.Test;

import com.cartlens.support.TestFixtures;

class PanePublisherTest {
	@Test
	void notifiesOnlyForCompletedPanesAndKeepsRemainderBuffered() {
		var published = new ArrayList<Long>();
		var publisher = new PanePublisher(2);
		publisher.subscribe(pane -> published.add(pane.paneId()));
		var transactions = TestFixtures.dse();
		publisher.publish(transactions.get(0));
		assertThat(published).isEmpty();
		publisher.publish(transactions.get(1));
		publisher.publish(transactions.get(2));
		assertThat(published).containsExactly(1L);
		assertThat(publisher.bufferedTransactionCount()).isEqualTo(1);
	}
}
