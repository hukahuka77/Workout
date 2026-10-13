import AuthForm from "@/components/AuthForm";
import { signupAction } from "../actions";
export default function Page() { return <AuthForm mode="signup" action={signupAction} />; }
