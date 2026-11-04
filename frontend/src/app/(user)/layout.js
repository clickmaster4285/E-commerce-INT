import UserLayoutClient from "./UserLayoutClient";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function Layout({ children }) {
  return <UserLayoutClient>{children}</UserLayoutClient>;
}
