import Card from "@/components/ui/Card";

import styles from "./RecentActivity.module.css";

export type RecentActivityItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  icon: string;
};

type Props = {
  activities: RecentActivityItem[];
};

export default function RecentActivity({
  activities,
}: Props) {
  return (
    <Card
      variant="elevated"
      padding="large"
    >
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            Hoạt động gần đây
          </h2>

          <p className={styles.description}>
            Những thay đổi mới nhất trong hệ thống.
          </p>
        </div>
      </div>

      <div className={styles.list}>
        {activities.map((activity) => (
          <article
            key={activity.id}
            className={styles.item}
          >
            <div className={styles.icon}>
              {activity.icon}
            </div>

            <div className={styles.content}>
              <div className={styles.itemTitle}>
                {activity.title}
              </div>

              <div className={styles.itemDescription}>
                {activity.description}
              </div>
            </div>

            <div className={styles.time}>
              {activity.time}
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}